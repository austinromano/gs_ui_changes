#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "GhostLog.h"

GhostSessionProcessor::GhostSessionProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input",  juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
    formatManager.registerBasicFormats();
    readAheadThread.startThread(juce::Thread::Priority::normal);
}

GhostSessionProcessor::~GhostSessionProcessor()
{
    transportSource.setSource(nullptr);
    if (standalonePlayerReady)
    {
        playerDeviceManager.removeAudioCallback(&sourcePlayer);
        sourcePlayer.setSource(nullptr);
    }
    readAheadThread.stopThread(2000);

    // Shut down networking before member destructors run.
    // SessionManager references webSocket, so disconnect the socket first
    // while SessionManager is still alive to safely remove its listener.
    webSocket.disconnect();
}

bool GhostSessionProcessor::isRunningAsPlugin() const
{
    // If the host has called prepareToPlay, we're running as a plugin
    return pluginPrepared;
}

bool GhostSessionProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    return layouts.getMainOutputChannelSet() == layouts.getMainInputChannelSet();
}

void GhostSessionProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    pluginPrepared = true;
    hostSampleRate = sampleRate;
    hostBlockSize = samplesPerBlock;

    // Prepare transport for plugin-mode playback through processBlock
    transportSource.prepareToPlay(samplesPerBlock, sampleRate);

    GhostLog::write("[Player] prepareToPlay: sr=" + juce::String(sampleRate)
                    + " bs=" + juce::String(samplesPerBlock));
}

void GhostSessionProcessor::releaseResources()
{
    transportSource.releaseResources();
}

void GhostSessionProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                           juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalIn  = getTotalNumInputChannels();
    auto totalOut = getTotalNumOutputChannels();
    auto numSamples = buffer.getNumSamples();

    // Clear unused output channels
    for (auto i = totalIn; i < totalOut; ++i)
        buffer.clear(i, 0, numSamples);

    // Measure input levels (peak) for the meter
    float peakL = 0.0f, peakR = 0.0f;
    if (totalIn > 0) peakL = buffer.getMagnitude(0, 0, numSamples);
    if (totalIn > 1) peakR = buffer.getMagnitude(1, 0, numSamples);
    inputLevelLeft.store(peakL, std::memory_order_relaxed);
    inputLevelRight.store(peakR, std::memory_order_relaxed);

    // Record input audio if recording
    if (recording.load(std::memory_order_relaxed) && totalIn > 0)
    {
        const juce::ScopedLock sl(recordLock);
        auto* chL = buffer.getReadPointer(0);
        recordBufferL.insert(recordBufferL.end(), chL, chL + numSamples);
        if (totalIn > 1)
        {
            auto* chR = buffer.getReadPointer(1);
            recordBufferR.insert(recordBufferR.end(), chR, chR + numSamples);
        }
    }

    // In plugin mode, mix transport audio into the output buffer
    if (pluginPrepared && transportSource.isPlaying())
    {
        juce::AudioSourceChannelInfo info(&buffer, 0, numSamples);
        transportSource.getNextAudioBlock(info);
    }
}

juce::AudioProcessorEditor* GhostSessionProcessor::createEditor()
{
    return new GhostSessionEditor(*this);
}

void GhostSessionProcessor::ensureStandaloneReady()
{
    if (standalonePlayerReady || pluginPrepared) return;

    GhostLog::write("[Player] Initialising standalone audio device...");

    auto err = playerDeviceManager.initialiseWithDefaultDevices(0, 2);
    if (err.isNotEmpty())
    {
        GhostLog::write("[Player] Device error: " + err);
        return;
    }

    sourcePlayer.setSource(&transportSource);
    playerDeviceManager.addAudioCallback(&sourcePlayer);
    standalonePlayerReady = true;

    auto* device = playerDeviceManager.getCurrentAudioDevice();
    if (device != nullptr)
    {
        GhostLog::write("[Player] Device: " + device->getName()
                        + " SR=" + juce::String(device->getCurrentSampleRate())
                        + " BS=" + juce::String(device->getCurrentBufferSizeSamples()));
    }
}

void GhostSessionProcessor::loadAndPlay(const juce::File& file)
{
    GhostLog::write("[Player] loadAndPlay: " + file.getFullPathName());

    // In standalone mode, set up our own audio device
    if (!pluginPrepared)
    {
        ensureStandaloneReady();
        if (!standalonePlayerReady)
        {
            GhostLog::write("[Player] Device not ready, cannot play");
            return;
        }
    }

    transportSource.stop();
    transportSource.setSource(nullptr);
    readerSource = nullptr;

    auto* reader = formatManager.createReaderFor(file);
    if (reader == nullptr)
    {
        GhostLog::write("[Player] Could not create reader for file");
        return;
    }

    GhostLog::write("[Player] Reader created: channels=" + juce::String((int)reader->numChannels)
                    + " sr=" + juce::String(reader->sampleRate)
                    + " length=" + juce::String(reader->lengthInSamples));

    readerSource = std::make_unique<juce::AudioFormatReaderSource>(reader, true);
    transportSource.setSource(readerSource.get(), 32768, &readAheadThread, reader->sampleRate);

    // In plugin mode, prepare at host sample rate
    if (pluginPrepared)
        transportSource.prepareToPlay(hostBlockSize, hostSampleRate);

    transportSource.setPosition(0.0);
    transportSource.start();

    GhostLog::write("[Player] Playing: " + juce::String(transportSource.isPlaying() ? "yes" : "no"));
}

void GhostSessionProcessor::stopPlayback()
{
    transportSource.stop();
    transportSource.setPosition(0.0);
}

bool GhostSessionProcessor::isPlaying() const
{
    return transportSource.isPlaying();
}

double GhostSessionProcessor::getPlaybackPosition() const
{
    double len = transportSource.getLengthInSeconds();
    if (len <= 0.0) return 0.0;
    return transportSource.getCurrentPosition() / len;
}

double GhostSessionProcessor::getPlaybackLengthSeconds() const
{
    return transportSource.getLengthInSeconds();
}

void GhostSessionProcessor::startRecording()
{
    {
        const juce::ScopedLock sl(recordLock);
        recordBufferL.clear();
        recordBufferR.clear();
        recordSampleRate = pluginPrepared ? hostSampleRate : 44100.0;
    }
    recording.store(true, std::memory_order_relaxed);
    GhostLog::write("[Recorder] Recording started at SR=" + juce::String(recordSampleRate));
}

void GhostSessionProcessor::stopRecording()
{
    recording.store(false, std::memory_order_relaxed);
    GhostLog::write("[Recorder] Recording stopped, samples=" + juce::String((int)recordBufferL.size()));

    const juce::ScopedLock sl(recordLock);
    if (recordBufferL.empty()) return;

    // Write to WAV in temp directory
    auto tempDir = juce::File::getSpecialLocation(juce::File::tempDirectory)
                       .getChildFile("GhostSession");
    if (!tempDir.exists()) tempDir.createDirectory();

    auto timestamp = juce::Time::getCurrentTime().formatted("%Y%m%d_%H%M%S");
    auto destFile = tempDir.getChildFile("recording_" + timestamp + ".wav");

    int numChannels = recordBufferR.empty() ? 1 : 2;
    int numSamples = (int)recordBufferL.size();

    juce::WavAudioFormat wavFormat;
    std::unique_ptr<juce::AudioFormatWriter> writer(
        wavFormat.createWriterFor(new juce::FileOutputStream(destFile),
                                   recordSampleRate, (unsigned int)numChannels, 24, {}, 0));

    if (writer != nullptr)
    {
        juce::AudioBuffer<float> outBuffer(numChannels, numSamples);
        outBuffer.copyFrom(0, 0, recordBufferL.data(), numSamples);
        if (numChannels == 2)
            outBuffer.copyFrom(1, 0, recordBufferR.data(), numSamples);

        writer->writeFromAudioSampleBuffer(outBuffer, 0, numSamples);
        writer.reset(); // flush & close

        lastRecordedFile = destFile;
        GhostLog::write("[Recorder] Saved: " + destFile.getFullPathName()
                        + " (" + juce::String(destFile.getSize()) + " bytes)");
    }

    recordBufferL.clear();
    recordBufferR.clear();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new GhostSessionProcessor();
}
