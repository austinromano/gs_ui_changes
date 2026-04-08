#include "GhostWebView.h"
#include "GhostLog.h"
#include "../Core/PluginProcessor.h"

GhostWebView::GhostWebView(const Options& options, GhostSessionProcessor& processor)
    : WebBrowserComponent(options), proc(processor)
{
    tempDir = juce::File::getSpecialLocation(juce::File::tempDirectory)
                  .getChildFile("GhostSession");
    if (!tempDir.exists())
        tempDir.createDirectory();

    // Push audio levels to JS at ~30fps
    startTimerHz(30);
}

GhostWebView::~GhostWebView()
{
    stopTimer();
}

bool GhostWebView::pageAboutToLoad(const juce::String& newURL)
{
    if (newURL.startsWith("ghost://drag-to-daw"))
    {
        GhostLog::write("[WebView] Intercepted drag-to-daw request");
        handleDragToDaw(newURL);
        return false;
    }

    if (newURL.startsWith("ghost://start-recording"))
    {
        GhostLog::write("[WebView] Intercepted start-recording");
        handleStartRecording();
        return false;
    }

    if (newURL.startsWith("ghost://stop-recording"))
    {
        GhostLog::write("[WebView] Intercepted stop-recording");
        handleStopRecording();
        return false;
    }

    if (newURL.startsWith("ghost://upload-recording"))
    {
        GhostLog::write("[WebView] Intercepted upload-recording");
        handleUploadRecording(newURL);
        return false;
    }

    if (newURL.startsWith("ghost://play-recording"))
    {
        GhostLog::write("[WebView] Intercepted play-recording");
        handlePlayRecording();
        return false;
    }

    if (newURL.startsWith("ghost://stop-playback"))
    {
        GhostLog::write("[WebView] Intercepted stop-playback");
        handleStopPlayback();
        return false;
    }

    // Grab auth token from the URL if present (e.g. ?token=XXX&mode=plugin)
    if (newURL.contains("token="))
    {
        auto token = getQueryParam(newURL, "token");
        if (token.isNotEmpty())
        {
            proc.getAppState().setAuthToken(token);
            GhostLog::write("[WebView] Auth token captured from URL (" + juce::String(token.length()) + " chars)");
        }
    }

    return true;
}

void GhostWebView::handleWebMessage(const juce::String& message)
{
    GhostLog::write("[WebView] postMessage received: " + message);

    if (message == "start-recording")
        handleStartRecording();
    else if (message == "stop-recording")
        handleStopRecording();
    else if (message == "play-recording")
        handlePlayRecording();
    else if (message == "stop-playback")
        handleStopPlayback();
    else if (message.startsWith("set-token:"))
    {
        auto token = message.fromFirstOccurrenceOf(":", false, false);
        proc.getAppState().setAuthToken(token);
        GhostLog::write("[WebView] Auth token set from JS (" + juce::String(token.length()) + " chars)");
    }
    else if (message.startsWith("upload-recording:"))
        handleUploadRecording("ghost://upload-recording?" + message.fromFirstOccurrenceOf(":", false, false));
}

void GhostWebView::timerCallback()
{
    float left  = proc.inputLevelLeft.load(std::memory_order_relaxed);
    float right = proc.inputLevelRight.load(std::memory_order_relaxed);
    bool isRec  = proc.isRecording();

    // Clamp to 0-1
    left  = juce::jlimit(0.0f, 1.0f, left);
    right = juce::jlimit(0.0f, 1.0f, right);

    bool isPlay = proc.isPlaying();
    double playPos = proc.getPlaybackPosition();
    double playLen = proc.getPlaybackLengthSeconds();

    juce::String js = "if(window.__ghostAudioLevels__){window.__ghostAudioLevels__("
                    + juce::String(left, 4) + ","
                    + juce::String(right, 4) + ","
                    + (isRec ? "true" : "false") + ");}";

    js += juce::String("if(window.__ghostPlaybackState__){window.__ghostPlaybackState__(")
        + (isPlay ? "true" : "false") + ","
        + juce::String(playPos, 4) + ","
        + juce::String(playLen, 2) + ");}";

    evaluateJavascript(js);
}

void GhostWebView::handleStartRecording()
{
    proc.startRecording();
}

void GhostWebView::handleStopRecording()
{
    proc.stopRecording();

    auto recordedFile = proc.getLastRecordedFile();
    if (recordedFile.existsAsFile())
    {
        GhostLog::write("[WebView] Recording saved: " + recordedFile.getFullPathName());

        // Tell the React UI the file is ready
        auto filePath = recordedFile.getFullPathName().replace("\\", "\\\\");
        auto fileName = recordedFile.getFileName();
        auto sizeKB = juce::String(recordedFile.getSize() / 1024);

        juce::String js = "if(window.__ghostRecordingComplete__){window.__ghostRecordingComplete__('"
                        + fileName + "'," + sizeKB + ");}";
        evaluateJavascript(js);
    }
}

void GhostWebView::handlePlayRecording()
{
    auto recordedFile = proc.getLastRecordedFile();
    GhostLog::write("[WebView] handlePlayRecording called, file="
                    + (recordedFile.existsAsFile() ? recordedFile.getFullPathName() : "NONE")
                    + " size=" + juce::String(recordedFile.getSize()));

    if (!recordedFile.existsAsFile() || recordedFile.getSize() == 0)
    {
        // Fallback: find the most recent recording in the temp dir
        auto tempDir = juce::File::getSpecialLocation(juce::File::tempDirectory)
                           .getChildFile("GhostSession");
        if (tempDir.isDirectory())
        {
            auto files = tempDir.findChildFiles(juce::File::findFiles, false, "recording_*.wav");
            if (!files.isEmpty())
            {
                // Sort by modification time, pick newest
                files.sort();
                recordedFile = files.getLast();
                GhostLog::write("[WebView] Using fallback file: " + recordedFile.getFullPathName());
            }
        }
    }

    if (recordedFile.existsAsFile() && recordedFile.getSize() > 0)
    {
        GhostLog::write("[WebView] Playing recording: " + recordedFile.getFullPathName());
        proc.loadAndPlay(recordedFile);
    }
    else
    {
        GhostLog::write("[WebView] No recorded file to play");
    }
}

void GhostWebView::handleStopPlayback()
{
    GhostLog::write("[WebView] Stopping playback");
    proc.stopPlayback();
}

void GhostWebView::handleUploadRecording(const juce::String& urlString)
{
    auto projectIdParam = getQueryParam(urlString, "projectId");
    auto fileNameParam = getQueryParam(urlString, "fileName");

    auto recordedFile = proc.getLastRecordedFile();
    if (!recordedFile.existsAsFile())
    {
        GhostLog::write("[WebView] No recorded file to upload");
        return;
    }

    GhostLog::write("[WebView] Uploading recording: " + recordedFile.getFullPathName()
                    + " to project: " + projectIdParam);

    juce::var metadata(new juce::DynamicObject());
    metadata.getDynamicObject()->setProperty("projectId", projectIdParam);

    auto safeThis = juce::Component::SafePointer<GhostWebView>(this);

    proc.getSessionManager().getApiClient().uploadFile(
        recordedFile, metadata,
        [](float progress) { /* could push progress to JS */ },
        [safeThis, fileNameParam](const ApiClient::Response& res)
        {
            juce::MessageManager::callAsync([safeThis, res, fileNameParam]()
            {
                if (safeThis == nullptr) return;

                if (res.isSuccess())
                {
                    auto fileId = res.body.getProperty("fileId", "").toString();
                    GhostLog::write("[WebView] Upload complete, fileId: " + fileId);

                    juce::String js = "if(window.__ghostUploadComplete__){window.__ghostUploadComplete__('"
                                    + fileId + "','" + fileNameParam + "');}";
                    safeThis->evaluateJavascript(js);
                }
                else
                {
                    GhostLog::write("[WebView] Upload failed: " + res.error);
                }
            });
        });
}

juce::String GhostWebView::getQueryParam(const juce::String& url, const juce::String& paramName)
{
    auto search = paramName + "=";
    int startIdx = url.indexOf(search);

    if (startIdx < 0)
        return {};

    startIdx += search.length();
    int endIdx = url.indexOf(startIdx, "&");

    if (endIdx < 0)
        endIdx = url.length();

    return juce::URL::removeEscapeChars(url.substring(startIdx, endIdx));
}

void GhostWebView::handleDragToDaw(const juce::String& urlString)
{
    auto downloadUrl = getQueryParam(urlString, "url");
    auto fileName = getQueryParam(urlString, "fileName");

    if (downloadUrl.isEmpty() || fileName.isEmpty())
    {
        GhostLog::write("[WebView] drag-to-daw missing url or fileName param");
        return;
    }

    GhostLog::write("[WebView] Downloading: " + fileName);
    auto localFile = downloadToTemp(downloadUrl, fileName);

    if (localFile.existsAsFile())
    {
        GhostLog::write("[WebView] Starting native drag: " + localFile.getFullPathName());

        auto filePath = localFile.getFullPathName();
        auto safeThis = juce::Component::SafePointer<GhostWebView>(this);

        juce::MessageManager::callAsync([filePath, safeThis]()
        {
            if (safeThis == nullptr)
            {
                GhostLog::write("[WebView] Plugin destroyed before drag could start");
                return;
            }

            GhostLog::write("[WebView] Executing native drag on message thread");
            juce::DragAndDropContainer::performExternalDragDropOfFiles(
                { filePath }, false, safeThis.getComponent());
        });
    }
    else
    {
        GhostLog::write("[WebView] Download failed for: " + fileName);
    }
}

juce::File GhostWebView::downloadToTemp(const juce::String& downloadUrl, const juce::String& fileName)
{
    auto destFile = tempDir.getChildFile(fileName);

    if (destFile.existsAsFile() && destFile.getSize() > 0)
    {
        GhostLog::write("[WebView] Using cached file: " + destFile.getFullPathName());
        return destFile;
    }

    juce::URL url(downloadUrl);
    auto stream = url.createInputStream(
        juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress)
            .withConnectionTimeoutMs(15000));

    if (stream != nullptr)
    {
        juce::FileOutputStream fos(destFile);

        if (fos.openedOk())
        {
            fos.writeFromInputStream(*stream, -1);
            fos.flush();
            GhostLog::write("[WebView] Downloaded " + juce::String(destFile.getSize()) + " bytes");
        }
    }

    return destFile;
}
