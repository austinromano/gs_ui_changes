#include "JuceHeader.h"
#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "GhostLog.h"

//==============================================================================
/**
 * AudioCallback that drives the processor's processBlock from the device manager.
 */
class StandaloneAudioCallback : public juce::AudioIODeviceCallback
{
public:
    StandaloneAudioCallback(GhostSessionProcessor& p) : proc(p) {}

    void audioDeviceAboutToStart(juce::AudioIODevice* device) override
    {
        auto sr = device->getCurrentSampleRate();
        auto bs = device->getCurrentBufferSizeSamples();
        GhostLog::write("[Standalone] Device starting: " + device->getName()
                        + " SR=" + juce::String(sr)
                        + " BS=" + juce::String(bs)
                        + " inputs=" + juce::String(device->getActiveInputChannels().countNumberOfSetBits())
                        + " outputs=" + juce::String(device->getActiveOutputChannels().countNumberOfSetBits()));
        proc.prepareToPlay(sr, bs);
    }

    void audioDeviceStopped() override
    {
        proc.releaseResources();
    }

    void audioDeviceIOCallbackWithContext(const float* const* inputChannelData,
                                          int numInputChannels,
                                          float* const* outputChannelData,
                                          int numOutputChannels,
                                          int numSamples,
                                          const juce::AudioIODeviceCallbackContext&) override
    {
        // Build a buffer from the output pointers
        juce::AudioBuffer<float> buffer(outputChannelData, numOutputChannels, numSamples);

        // Copy input into the buffer so processBlock can read it
        for (int ch = 0; ch < juce::jmin(numInputChannels, numOutputChannels); ++ch)
        {
            if (inputChannelData[ch] != nullptr)
                buffer.copyFrom(ch, 0, inputChannelData[ch], numSamples);
        }

        juce::MidiBuffer midi;
        proc.processBlock(buffer, midi);
    }

private:
    GhostSessionProcessor& proc;
};

//==============================================================================
class GhostStandaloneApp : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override    { return "Ghost Session"; }
    const juce::String getApplicationVersion() override { return "2.0.0"; }

    void initialise(const juce::String&) override
    {
        GhostLog::write("[Standalone] initialise: start");
        try
        {
            processor = std::make_unique<GhostSessionProcessor>();
            audioCallback = std::make_unique<StandaloneAudioCallback>(*processor);

            // Set up audio device with stereo input + output
            deviceManager = std::make_unique<juce::AudioDeviceManager>();

            // Try to restore saved audio settings
            auto settingsFile = getSettingsFile();
            juce::String savedState;
            if (settingsFile.existsAsFile())
                savedState = settingsFile.loadFileAsString();

            if (savedState.isNotEmpty())
            {
                auto xml = juce::parseXML(savedState);
                if (xml)
                    deviceManager->initialise(2, 2, xml.get(), true);
                else
                    deviceManager->initialiseWithDefaultDevices(2, 2);
            }
            else
            {
                deviceManager->initialiseWithDefaultDevices(2, 2);
            }

            deviceManager->addAudioCallback(audioCallback.get());

            auto* device = deviceManager->getCurrentAudioDevice();
            if (device)
            {
                GhostLog::write("[Standalone] Audio device: " + device->getName()
                                + " SR=" + juce::String(device->getCurrentSampleRate())
                                + " BS=" + juce::String(device->getCurrentBufferSizeSamples())
                                + " in=" + juce::String(device->getActiveInputChannels().countNumberOfSetBits())
                                + " out=" + juce::String(device->getActiveOutputChannels().countNumberOfSetBits()));
            }
            else
            {
                GhostLog::write("[Standalone] WARNING: No audio device available");
            }

            mainWindow = std::make_unique<MainWindow>(*processor, *deviceManager);
            GhostLog::write("[Standalone] initialise: complete");
        }
        catch (const std::exception& e)
        {
            GhostLog::write("[Standalone] EXCEPTION: " + juce::String(e.what()));
            quit();
        }
        catch (...)
        {
            GhostLog::write("[Standalone] UNKNOWN EXCEPTION");
            quit();
        }
    }

    void shutdown() override
    {
        GhostLog::write("[Standalone] shutdown");

        // Save audio settings
        if (deviceManager)
        {
            auto xml = deviceManager->createStateXml();
            if (xml)
                getSettingsFile().replaceWithText(xml->toString());

            deviceManager->removeAudioCallback(audioCallback.get());
        }

        mainWindow = nullptr;
        audioCallback = nullptr;
        deviceManager = nullptr;
        processor = nullptr;
    }

    void unhandledException(const std::exception* e, const juce::String& sourceFile, int lineNumber) override
    {
        GhostLog::write("[Standalone] UNHANDLED EXCEPTION in " + sourceFile + ":"
                        + juce::String(lineNumber) + " - " + (e ? e->what() : "unknown"));
    }

    //==========================================================================
    class MainWindow : public juce::DocumentWindow,
                       public juce::MenuBarModel
    {
    public:
        MainWindow(GhostSessionProcessor& proc, juce::AudioDeviceManager& dm)
            : DocumentWindow("Ghost Session",
                             juce::Colour(0xFF1A1A2E),
                             DocumentWindow::allButtons),
              deviceManager(dm)
        {
            setResizable(true, true);
            setUsingNativeTitleBar(true);
            setVisible(true);

            // Add the plugin editor as main content
            setContentOwned(proc.createEditor(), true);
            centreWithSize(getWidth(), getHeight());

            // Add menu bar for audio settings
            setMenuBar(this);
        }

        ~MainWindow() override
        {
            setMenuBar(nullptr);
        }

        void closeButtonPressed() override
        {
            juce::JUCEApplication::getInstance()->systemRequestedQuit();
        }

        // MenuBarModel
        juce::StringArray getMenuBarNames() override
        {
            return { "Audio" };
        }

        juce::PopupMenu getMenuForIndex(int menuIndex, const juce::String&) override
        {
            juce::PopupMenu menu;
            if (menuIndex == 0)
                menu.addItem(1, "Audio Settings...");
            return menu;
        }

        void menuItemSelected(int menuItemID, int) override
        {
            if (menuItemID == 1)
            {
                auto selector = std::make_unique<juce::AudioDeviceSelectorComponent>(
                    deviceManager, 1, 2, 1, 2, false, false, true, false);
                selector->setSize(500, 400);

                juce::DialogWindow::LaunchOptions options;
                options.content.setOwned(selector.release());
                options.dialogTitle = "Audio Settings";
                options.dialogBackgroundColour = juce::Colour(0xFF1A1A2E);
                options.escapeKeyTriggersCloseButton = true;
                options.useNativeTitleBar = true;
                options.resizable = false;
                options.launchAsync();
            }
        }

    private:
        juce::AudioDeviceManager& deviceManager;

        JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainWindow)
    };

private:
    std::unique_ptr<GhostSessionProcessor> processor;
    std::unique_ptr<juce::AudioDeviceManager> deviceManager;
    std::unique_ptr<StandaloneAudioCallback> audioCallback;
    std::unique_ptr<MainWindow> mainWindow;

    juce::File getSettingsFile() const
    {
        return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
                   .getChildFile("GhostSession")
                   .getChildFile("audio-settings.xml");
    }
};

JUCE_CREATE_APPLICATION_DEFINE(GhostStandaloneApp)
