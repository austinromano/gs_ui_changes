#pragma once

#include "JuceHeader.h"
#include "GhostTheme.h"

//==============================================================================
// Full-screen session workspace matching the Ghost Session mockup
class SessionWorkspaceView : public juce::Component,
                              public juce::Timer
{
public:
    SessionWorkspaceView();
    ~SessionWorkspaceView() override;

    void paint(juce::Graphics&) override;
    void resized() override;
    void mouseDown(const juce::MouseEvent&) override;
    void mouseDrag(const juce::MouseEvent&) override;
    void mouseUp(const juce::MouseEvent&) override;
    void timerCallback() override;

    // Callbacks
    std::function<void()> onInviteClicked;
    std::function<void(const juce::String&)> onChatSend;
    std::function<void(int)> onSessionSelected;

    void setProjectName(const juce::String& name) { projectName = name; repaint(); }
    void setActiveTab(int idx) { activeTab = idx; repaint(); }

    // Chat
    struct ChatMsg { juce::String author; juce::String text; juce::Colour colour; int timeSec; };
    void addChatMessage(const juce::String& author, const juce::String& text, juce::Colour c);

    // Track data
    struct TrackInfo { juce::String name; juce::String type; bool muted = false; bool soloed = false; float volume = 0.8f; };
    void setTracks(const std::vector<TrackInfo>& t) { tracks = t; repaint(); }

    // Sessions list
    struct SessionItem { juce::String id; juce::String name; };
    void setSessions(const std::vector<SessionItem>& s) { sessions = s; repaint(); }

    // Collaborators
    struct CollabInfo { juce::String name; juce::Colour colour; };
    void setCollaborators(const std::vector<CollabInfo>& c) { collaborators = c; repaint(); }

private:
    juce::String projectName = "Sacred Dreams";
    int activeTab = 1; // 0=Projects, 1=Sessions, 2=Library, 3=AI Assist
    bool isPlaying = false;
    bool isLooping = false;
    float playheadPos = 0.32f;

    // Sessions
    std::vector<SessionItem> sessions;
    int selectedSession = 0;

    // Collaborators
    std::vector<CollabInfo> collaborators;

    // Tracks
    std::vector<TrackInfo> tracks;
    std::vector<float> trackVolumes;

    // Chat
    std::vector<ChatMsg> chatMessages;
    juce::String chatInput;

    // Ghost Keys XY pad
    float ghostKeysX = 0.4f, ghostKeysY = 0.6f;
    bool draggingGhostKeys = false;

    // Effect knob
    float effectValue = 0.5f;
    bool draggingKnob = false;
    int knobDragStartY = 0;
    float knobDragStartVal = 0.0f;

    // Layout constants
    static constexpr int kTopBarH = 40;
    static constexpr int kSidebarW = 190;
    static constexpr int kChatW = 220;
    static constexpr int kBottomH = 130;
    static constexpr int kTransportH = 36;

    // Track colors
    juce::Colour getTrackColour(const juce::String& type) const;

    // Drawing methods
    void drawTopBar(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawLeftSidebar(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawSessionArea(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawTransportBar(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawTrackTimeline(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawChatPanel(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawBottomPanel(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawGhostKeys(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawEffectKnob(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawMasterMeter(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawVersionHistory(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawVersionPreview(juce::Graphics& g, juce::Rectangle<int> bounds);
    void drawAvatar(juce::Graphics& g, int cx, int cy, int radius, const juce::String& name, juce::Colour colour);
    void drawWaveformClip(juce::Graphics& g, juce::Rectangle<int> bounds, juce::Colour colour, int seed);

    // Hit areas for interaction
    juce::Rectangle<int> playButtonArea, ghostKeysArea, knobArea;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SessionWorkspaceView)
};
