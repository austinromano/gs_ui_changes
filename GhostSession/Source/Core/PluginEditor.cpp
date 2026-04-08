#include "PluginEditor.h"

//==============================================================================
GhostSessionEditor::GhostSessionEditor(GhostSessionProcessor& p)
    : AudioProcessorEditor(&p), proc(p)
{
    // Configure WebView — uses WKWebView on macOS, WebView2 on Windows
    auto options = juce::WebBrowserComponent::Options()
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withUserAgent("GhostSession/2.0 JUCE-Plugin");

#if JUCE_WINDOWS
    options = options.withBackend(juce::WebBrowserComponent::Options::Backend::webview2);
#endif

    webView = std::make_unique<GhostWebView>(options);
    addAndMakeVisible(*webView);

    // Navigate to the React app
    webView->goToURL(getAppUrl());

    setResizable(true, true);
    setResizeLimits(900, 500, 1920, 1200);
    setSize(1100, 720);
}

GhostSessionEditor::~GhostSessionEditor()
{
    if (webView)
    {
        removeChildComponent(webView.get());
        webView->setVisible(false);
    }
    webView = nullptr;
}

void GhostSessionEditor::paint(juce::Graphics& g)
{
    // Dark background shown briefly while WebView loads
    g.fillAll(juce::Colour(0xFF1A1A2E));

    if (!webView || !webView->isVisible())
    {
        g.setColour(juce::Colour(0xFF8B5CF6));
        g.setFont(juce::Font(18.0f));
        g.drawText("Loading Ghost Session...",
                   getLocalBounds(), juce::Justification::centred);
    }
}

void GhostSessionEditor::resized()
{
    if (webView)
        webView->setBounds(getLocalBounds());
}

juce::String GhostSessionEditor::getAppUrl() const
{
    // Production: point to the cloud server
    // For local dev, change this to "http://127.0.0.1:1420" or "http://localhost:3000"
    juce::String url = "https://ghost-session-beta-production.up.railway.app";

    // Pass auth token if available so the React app can auto-login
    auto token = proc.getClient().getAuthToken();
    if (token.isNotEmpty())
        url += "?token=" + juce::URL::addEscapeChars(token, true) + "&mode=plugin";
    else
        url += "?mode=plugin";

    return url;
}
