#include "SessionWorkspaceView.h"

//==============================================================================
static float pseudoRandom(int seed)
{
    seed = (seed * 16807 + 11) % 2147483647;
    return static_cast<float>(seed % 10000) / 10000.0f;
}

//==============================================================================
SessionWorkspaceView::SessionWorkspaceView()
{
    // Default sessions
    sessions = { {"1", "Sacred Dreams"}, {"2", "Midnight Tape"}, {"3", "Ascension"}, {"4", "Vibe Pack"} };

    // Default collaborators
    collaborators = {
        {"Austin", juce::Colour(0xFF8B5CF6)},
        {"Mike",   juce::Colour(0xFF42A5F5)},
        {"Sarah",  juce::Colour(0xFFFF6B6B)},
        {"JayC",   juce::Colour(0xFFFFD700)},
        {"You",    juce::Colour(0xFF00FFC8)}
    };

    // Default tracks
    tracks = {
        {"GUITAR", "audio", false, false, 0.8f},
        {"DRUMS",  "drum",  false, false, 0.75f},
        {"BASS",   "audio", false, false, 0.7f},
        {"SYNTH",  "midi",  false, false, 0.65f}
    };

    // Default chat
    chatMessages = {
        {"Mike",  "Added new guitar loop",       juce::Colour(0xFF42A5F5), 120},
        {"Mike",  "Drums are fire!",             juce::Colour(0xFF42A5F5), 60},
        {"Sarah", "Let's drop the synth here ->", juce::Colour(0xFFFF6B6B), 30}
    };

    startTimerHz(30);
}

SessionWorkspaceView::~SessionWorkspaceView()
{
    stopTimer();
}

void SessionWorkspaceView::timerCallback()
{
    if (isPlaying)
    {
        playheadPos += 0.0005f;
        if (playheadPos > 1.0f) playheadPos = 0.0f;
        repaint();
    }
}

juce::Colour SessionWorkspaceView::getTrackColour(const juce::String& type) const
{
    if (type == "audio") return GhostColours::audioTrack;
    if (type == "midi")  return GhostColours::midiTrack;
    if (type == "drum")  return GhostColours::drumTrack;
    if (type == "loop")  return GhostColours::loopTrack;
    return GhostColours::audioTrack;
}

//==============================================================================
void SessionWorkspaceView::paint(juce::Graphics& g)
{
    g.fillAll(GhostColours::background);

    auto bounds = getLocalBounds();

    // Top bar
    auto topBar = bounds.removeFromTop(kTopBarH);
    drawTopBar(g, topBar);

    // Bottom panel
    auto bottomPanel = bounds.removeFromBottom(kBottomH);
    drawBottomPanel(g, bottomPanel);

    // Left sidebar
    auto sidebar = bounds.removeFromLeft(kSidebarW);
    drawLeftSidebar(g, sidebar);

    // Chat panel (right)
    auto chat = bounds.removeFromRight(kChatW);
    drawChatPanel(g, chat);

    // Remaining = session area (transport + timeline)
    drawSessionArea(g, bounds);
}

void SessionWorkspaceView::resized() {}

//==============================================================================
void SessionWorkspaceView::drawTopBar(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::surface);
    g.fillRect(bounds);
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getX(), (float)bounds.getBottom(),
               (float)bounds.getRight(), (float)bounds.getBottom(), 1.0f);

    int x = bounds.getX() + 12;
    int cy = bounds.getCentreY();

    // Ghost icon (purple circle)
    g.setColour(GhostColours::ghostPurple.withAlpha(0.3f));
    g.fillEllipse((float)x, (float)(cy - 10), 20.0f, 20.0f);
    g.setColour(GhostColours::ghostPurple.withAlpha(0.6f));
    g.drawEllipse((float)x, (float)(cy - 10), 20.0f, 20.0f, 1.0f);
    x += 28;

    // Logo text
    g.setColour(GhostColours::textPrimary);
    g.setFont(juce::Font(14.0f, juce::Font::bold));
    g.drawText("GHOST", x, bounds.getY(), 50, bounds.getHeight(), juce::Justification::centredLeft);
    x += 50;
    g.setColour(GhostColours::ghostPurple);
    g.drawText("SESSION", x, bounds.getY(), 65, bounds.getHeight(), juce::Justification::centredLeft);
    x += 80;

    // Tab buttons
    const juce::StringArray tabs = {"PROJECTS", "SESSIONS", "LIBRARY", "AI ASSIST"};
    for (int i = 0; i < tabs.size(); ++i)
    {
        int tw = 75;
        auto tabBounds = juce::Rectangle<int>(x, cy - 12, tw, 24);

        if (i == activeTab)
        {
            g.setColour(GhostColours::ghostPurple.withAlpha(0.2f));
            g.fillRoundedRectangle(tabBounds.toFloat(), 4.0f);
            g.setColour(GhostColours::ghostPurple);
        }
        else
        {
            g.setColour(GhostColours::textMuted);
        }

        g.setFont(juce::Font(10.0f, juce::Font::bold));
        g.drawText(tabs[i], tabBounds, juce::Justification::centred);
        x += tw + 4;
    }

    // Right side icons (search, settings, bell, avatar)
    int rx = bounds.getRight() - 120;

    // Search icon (circle + line)
    g.setColour(GhostColours::textMuted);
    g.drawEllipse((float)rx, (float)(cy - 6), 12.0f, 12.0f, 1.5f);
    g.drawLine((float)(rx + 10), (float)(cy + 4), (float)(rx + 14), (float)(cy + 8), 1.5f);
    rx += 28;

    // Settings gear (simple circle)
    g.drawEllipse((float)rx, (float)(cy - 6), 12.0f, 12.0f, 1.5f);
    g.fillEllipse((float)(rx + 4), (float)(cy - 2), 4.0f, 4.0f);
    rx += 28;

    // Bell
    g.drawEllipse((float)rx, (float)(cy - 6), 12.0f, 12.0f, 1.5f);
    // Notification dot
    g.setColour(GhostColours::ghostPurple);
    g.fillEllipse((float)(rx + 9), (float)(cy - 7), 5.0f, 5.0f);
    rx += 28;

    // User avatar
    drawAvatar(g, rx + 8, cy, 10, "AU", GhostColours::ghostPurple);
}

//==============================================================================
void SessionWorkspaceView::drawLeftSidebar(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::surface);
    g.fillRect(bounds);
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getRight(), (float)bounds.getY(),
               (float)bounds.getRight(), (float)bounds.getBottom(), 1.0f);

    int x = bounds.getX() + 12;
    int y = bounds.getY() + 12;

    // SESSIONS header
    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(9.0f, juce::Font::bold));
    g.drawText("SESSIONS", x, y, 100, 14, juce::Justification::centredLeft);
    y += 22;

    // Favorites label
    g.setFont(juce::Font(9.0f));
    g.drawText("Favorites", x, y, 80, 12, juce::Justification::centredLeft);
    y += 18;

    // Session list
    for (int i = 0; i < (int)sessions.size(); ++i)
    {
        bool active = (i == selectedSession);
        auto rowBounds = juce::Rectangle<int>(bounds.getX() + 6, y, bounds.getWidth() - 12, 26);

        if (active)
        {
            g.setColour(GhostColours::ghostPurple.withAlpha(0.15f));
            g.fillRoundedRectangle(rowBounds.toFloat(), 4.0f);
        }

        // Dot
        g.setColour(active ? GhostColours::ghostPurple : GhostColours::textMuted);
        g.fillEllipse((float)(x + 2), (float)(y + 9), 5.0f, 5.0f);

        // Name
        g.setColour(active ? GhostColours::textPrimary : GhostColours::textSecondary);
        g.setFont(juce::Font(11.0f));
        g.drawText(sessions[i].name, x + 14, y, 140, 26, juce::Justification::centredLeft);

        y += 28;
    }

    // Collaborators section
    int collabY = bounds.getBottom() - 30 - (int)collaborators.size() * 26;
    g.setColour(GhostColours::border);
    g.drawLine((float)(bounds.getX() + 8), (float)(collabY - 8),
               (float)(bounds.getRight() - 8), (float)(collabY - 8), 1.0f);

    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(9.0f, juce::Font::bold));
    g.drawText("COLLABORATORS (" + juce::String((int)collaborators.size()) + ")",
               x, collabY, 150, 14, juce::Justification::centredLeft);
    collabY += 20;

    for (auto& collab : collaborators)
    {
        drawAvatar(g, x + 8, collabY + 8, 8, collab.name.substring(0, 1), collab.colour);

        g.setColour(GhostColours::textSecondary);
        g.setFont(juce::Font(11.0f));
        g.drawText(collab.name, x + 22, collabY, 120, 18, juce::Justification::centredLeft);

        collabY += 24;
    }
}

//==============================================================================
void SessionWorkspaceView::drawSessionArea(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    // Transport bar
    auto transport = bounds.removeFromTop(kTransportH);
    drawTransportBar(g, transport);

    // Track timeline
    drawTrackTimeline(g, bounds);
}

void SessionWorkspaceView::drawTransportBar(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getX(), (float)bounds.getBottom(),
               (float)bounds.getRight(), (float)bounds.getBottom(), 1.0f);

    int x = bounds.getX() + 12;
    int cy = bounds.getCentreY();

    // Back arrow
    g.setColour(GhostColours::textMuted);
    auto arrowPath = juce::Path();
    arrowPath.addTriangle((float)(x + 8), (float)(cy - 5), (float)(x + 8), (float)(cy + 5), (float)x, (float)cy);
    g.fillPath(arrowPath);
    x += 20;

    // Project name
    g.setColour(GhostColours::textPrimary);
    g.setFont(juce::Font(13.0f, juce::Font::bold));
    g.drawText(projectName, x, bounds.getY(), 150, bounds.getHeight(), juce::Justification::centredLeft);
    x += 160;

    // Transport controls
    // Skip back
    g.setColour(GhostColours::textMuted);
    g.fillRect(x, cy - 5, 2, 10);
    auto skipBack = juce::Path();
    skipBack.addTriangle((float)(x + 12), (float)(cy - 5), (float)(x + 12), (float)(cy + 5), (float)(x + 4), (float)cy);
    g.fillPath(skipBack);
    x += 20;

    // Play button
    playButtonArea = juce::Rectangle<int>(x, cy - 11, 22, 22);
    g.setColour(GhostColours::ghostGreen);
    g.fillEllipse(playButtonArea.toFloat());
    g.setColour(GhostColours::background);
    if (isPlaying)
    {
        g.fillRect(x + 7, cy - 4, 3, 8);
        g.fillRect(x + 12, cy - 4, 3, 8);
    }
    else
    {
        auto playTriangle = juce::Path();
        playTriangle.addTriangle((float)(x + 8), (float)(cy - 4), (float)(x + 8), (float)(cy + 4), (float)(x + 15), (float)cy);
        g.fillPath(playTriangle);
    }
    x += 28;

    // Skip forward
    g.setColour(GhostColours::textMuted);
    auto skipFwd = juce::Path();
    skipFwd.addTriangle((float)x, (float)(cy - 5), (float)x, (float)(cy + 5), (float)(x + 8), (float)cy);
    g.fillPath(skipFwd);
    g.fillRect(x + 10, cy - 5, 2, 10);
    x += 20;

    // Loop
    g.setColour(isLooping ? GhostColours::ghostPurple : GhostColours::textMuted);
    g.drawRoundedRectangle((float)x, (float)(cy - 5), 14.0f, 10.0f, 3.0f, 1.5f);
    x += 24;

    // Time display
    g.setColour(GhostColours::textSecondary);
    g.setFont(juce::Font(juce::Font::getDefaultMonospacedFontName(), 11.0f, juce::Font::plain));
    int totalSec = (int)(playheadPos * 180.0f);
    int mm = totalSec / 60, ss = totalSec % 60;
    auto timeStr = juce::String::formatted("%02d:%02d:00", mm, ss);
    g.drawText(timeStr, x, bounds.getY(), 60, bounds.getHeight(), juce::Justification::centredLeft);

    // INVITE button (right side)
    int invX = bounds.getRight() - 80;
    auto invBounds = juce::Rectangle<int>(invX, cy - 11, 70, 22);
    g.setColour(GhostColours::surfaceLight);
    g.fillRoundedRectangle(invBounds.toFloat(), 4.0f);
    g.setColour(GhostColours::border);
    g.drawRoundedRectangle(invBounds.toFloat(), 4.0f, 1.0f);
    g.setColour(GhostColours::ghostPurple);
    g.setFont(juce::Font(10.0f, juce::Font::bold));
    g.drawText("+ INVITE", invBounds, juce::Justification::centred);
}

//==============================================================================
void SessionWorkspaceView::drawTrackTimeline(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    auto area = bounds.reduced(8);

    // Background
    g.setColour(GhostColours::background.darker(0.2f));
    g.fillRoundedRectangle(area.toFloat(), 6.0f);
    g.setColour(GhostColours::border);
    g.drawRoundedRectangle(area.toFloat(), 6.0f, 1.0f);

    int labelW = 100;

    // Timeline ruler
    auto ruler = area.removeFromTop(22);
    g.setColour(GhostColours::border);
    g.drawLine((float)ruler.getX(), (float)ruler.getBottom(),
               (float)ruler.getRight(), (float)ruler.getBottom(), 0.5f);

    int timelineX = ruler.getX() + labelW;
    int timelineW = ruler.getWidth() - labelW;
    const int markers[] = {1, 5, 9, 13, 17, 21, 25, 29};
    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(juce::Font::getDefaultMonospacedFontName(), 9.0f, juce::Font::plain));
    for (int i = 0; i < 8; ++i)
    {
        int mx = timelineX + (int)((float)i / 7.0f * (float)timelineW);
        g.drawText(juce::String(markers[i]), mx - 8, ruler.getY(), 16, ruler.getHeight(), juce::Justification::centred);
    }

    // Tracks
    int trackH = juce::jmin(60, (area.getHeight()) / juce::jmax(1, (int)tracks.size()));

    // Clip patterns per track
    struct ClipDef { float start; float width; };
    const std::vector<std::vector<ClipDef>> clipPatterns = {
        {{0.0f, 0.35f}, {0.40f, 0.25f}, {0.70f, 0.28f}},
        {{0.05f, 0.20f}, {0.30f, 0.40f}, {0.75f, 0.22f}},
        {{0.0f, 0.45f}, {0.50f, 0.48f}},
        {{0.10f, 0.30f}, {0.45f, 0.20f}, {0.68f, 0.30f}}
    };

    for (int i = 0; i < (int)tracks.size(); ++i)
    {
        auto trackBounds = area.removeFromTop(trackH);
        auto& track = tracks[i];
        auto colour = getTrackColour(track.type);

        // Border
        g.setColour(GhostColours::border.withAlpha(0.3f));
        g.drawLine((float)trackBounds.getX(), (float)trackBounds.getBottom(),
                   (float)trackBounds.getRight(), (float)trackBounds.getBottom(), 0.5f);

        // Label area
        auto labelArea = trackBounds.removeFromLeft(labelW);

        // Color strip
        g.setColour(colour);
        g.fillRoundedRectangle((float)(labelArea.getX() + 8), (float)(labelArea.getCentreY() - 14), 3.0f, 28.0f, 1.5f);

        // Track name
        g.setColour(GhostColours::textPrimary);
        g.setFont(juce::Font(10.0f, juce::Font::bold));
        g.drawText(track.name, labelArea.getX() + 18, labelArea.getY() + 4, 60, 14, juce::Justification::centredLeft);

        // M/S buttons
        int bx = labelArea.getX() + 18;
        int by = labelArea.getY() + 20;
        // Mute
        g.setColour(track.muted ? GhostColours::warningAmber.withAlpha(0.3f) : GhostColours::textMuted.withAlpha(0.5f));
        g.fillRoundedRectangle((float)bx, (float)by, 14.0f, 12.0f, 2.0f);
        g.setColour(track.muted ? GhostColours::warningAmber : GhostColours::textMuted);
        g.setFont(juce::Font(8.0f, juce::Font::bold));
        g.drawText("M", bx, by, 14, 12, juce::Justification::centred);
        bx += 17;
        // Solo
        g.setColour(track.soloed ? GhostColours::hostGold.withAlpha(0.3f) : GhostColours::textMuted.withAlpha(0.5f));
        g.fillRoundedRectangle((float)bx, (float)by, 14.0f, 12.0f, 2.0f);
        g.setColour(track.soloed ? GhostColours::hostGold : GhostColours::textMuted);
        g.drawText("S", bx, by, 14, 12, juce::Justification::centred);

        // Volume slider (small horizontal)
        int sliderX = labelArea.getX() + 18;
        int sliderY = by + 16;
        int sliderW = labelArea.getWidth() - 30;
        g.setColour(GhostColours::border);
        g.fillRoundedRectangle((float)sliderX, (float)(sliderY + 1), (float)sliderW, 2.0f, 1.0f);
        float vol = (i < (int)trackVolumes.size()) ? trackVolumes[i] : track.volume;
        g.setColour(colour.withAlpha(0.7f));
        g.fillRoundedRectangle((float)sliderX, (float)(sliderY + 1), (float)sliderW * vol, 2.0f, 1.0f);
        g.setColour(GhostColours::textPrimary);
        g.fillEllipse((float)(sliderX + (int)((float)sliderW * vol) - 3), (float)(sliderY - 1), 6.0f, 6.0f);

        // Waveform clips
        g.setColour(GhostColours::border);
        g.drawLine((float)trackBounds.getX(), (float)trackBounds.getY(),
                   (float)trackBounds.getX(), (float)trackBounds.getBottom(), 0.5f);

        auto& clips = clipPatterns[i % clipPatterns.size()];
        for (int c = 0; c < (int)clips.size(); ++c)
        {
            int cx = trackBounds.getX() + (int)(clips[c].start * (float)trackBounds.getWidth());
            int cw = (int)(clips[c].width * (float)trackBounds.getWidth());
            auto clipBounds = juce::Rectangle<int>(cx, trackBounds.getY() + 3, cw, trackBounds.getHeight() - 6);
            drawWaveformClip(g, clipBounds, colour, i * 100 + c * 37);
        }

        // Playhead on this track
        int phx = trackBounds.getX() + (int)(playheadPos * (float)trackBounds.getWidth());
        g.setColour(GhostColours::ghostGreen.withAlpha(0.7f));
        g.drawLine((float)phx, (float)trackBounds.getY(), (float)phx, (float)trackBounds.getBottom(), 1.0f);
    }

    // Playhead on ruler
    int phRulerX = (area.getX() > 0 ? timelineX : timelineX) + (int)(playheadPos * (float)timelineW);
    g.setColour(GhostColours::ghostGreen);
    // Diamond marker
    auto diamond = juce::Path();
    diamond.addTriangle((float)(phRulerX - 4), (float)(ruler.getBottom()), (float)(phRulerX + 4), (float)(ruler.getBottom()), (float)phRulerX, (float)(ruler.getBottom() - 6));
    g.fillPath(diamond);
}

//==============================================================================
void SessionWorkspaceView::drawWaveformClip(juce::Graphics& g, juce::Rectangle<int> bounds, juce::Colour colour, int seed)
{
    // Clip background
    g.setColour(colour.withAlpha(0.08f));
    g.fillRoundedRectangle(bounds.toFloat(), 3.0f);
    g.setColour(colour.withAlpha(0.2f));
    g.drawRoundedRectangle(bounds.toFloat(), 3.0f, 1.0f);

    // Waveform bars
    int barCount = bounds.getWidth() / 2;
    float cx = (float)bounds.getX() + 1.0f;
    float midY = (float)bounds.getCentreY();
    float maxH = (float)bounds.getHeight() * 0.4f;

    for (int i = 0; i < barCount; ++i)
    {
        float h = (0.15f + pseudoRandom(seed + i) * 0.85f) * maxH;
        g.setColour(colour.withAlpha(0.5f));
        g.fillRect(cx, midY - h, 1.0f, h * 2.0f);
        cx += 2.0f;
    }
}

//==============================================================================
void SessionWorkspaceView::drawChatPanel(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::surface);
    g.fillRect(bounds);
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getX(), (float)bounds.getY(),
               (float)bounds.getX(), (float)bounds.getBottom(), 1.0f);

    int x = bounds.getX() + 10;
    int y = bounds.getY() + 10;

    // Header
    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(9.0f, juce::Font::bold));
    g.drawText("CHAT:", x, y, 60, 14, juce::Justification::centredLeft);
    y += 24;

    // Divider
    g.setColour(GhostColours::border);
    g.drawLine((float)x, (float)y, (float)(bounds.getRight() - 10), (float)y, 0.5f);
    y += 10;

    // Messages
    for (auto& msg : chatMessages)
    {
        // Avatar
        drawAvatar(g, x + 8, y + 8, 8, msg.author.substring(0, 1), msg.colour);

        // Author + time
        g.setColour(msg.colour);
        g.setFont(juce::Font(10.0f, juce::Font::bold));
        g.drawText(msg.author, x + 22, y, 80, 14, juce::Justification::centredLeft);

        g.setColour(GhostColours::textMuted);
        g.setFont(juce::Font(8.0f));
        g.drawText(juce::String(msg.timeSec) + "s", x + 100, y, 30, 14, juce::Justification::centredLeft);

        // Text
        g.setColour(GhostColours::textPrimary);
        g.setFont(juce::Font(10.0f));
        g.drawText(msg.text, x + 22, y + 14, bounds.getWidth() - 36, 14, juce::Justification::centredLeft);

        y += 36;
    }

    // Input area at bottom
    int inputY = bounds.getBottom() - 36;
    g.setColour(GhostColours::border);
    g.drawLine((float)x, (float)(inputY - 4), (float)(bounds.getRight() - 10), (float)(inputY - 4), 0.5f);

    auto inputBounds = juce::Rectangle<int>(x, inputY, bounds.getWidth() - 44, 26);
    g.setColour(GhostColours::surfaceLight);
    g.fillRoundedRectangle(inputBounds.toFloat(), 4.0f);
    g.setColour(GhostColours::border);
    g.drawRoundedRectangle(inputBounds.toFloat(), 4.0f, 1.0f);
    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(9.0f));
    g.drawText("Type a message...", inputBounds.reduced(6, 0), juce::Justification::centredLeft);

    // Send button
    auto sendBounds = juce::Rectangle<int>(inputBounds.getRight() + 4, inputY, 24, 26);
    g.setColour(GhostColours::ghostPurple);
    g.fillRoundedRectangle(sendBounds.toFloat(), 4.0f);
    // Arrow icon
    g.setColour(juce::Colours::white);
    auto arrow = juce::Path();
    float sx = (float)sendBounds.getCentreX(), sy = (float)sendBounds.getCentreY();
    arrow.addTriangle(sx - 4, sy - 3, sx - 4, sy + 3, sx + 4, sy);
    g.fillPath(arrow);
}

//==============================================================================
void SessionWorkspaceView::drawBottomPanel(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::surface);
    g.fillRect(bounds);
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getX(), (float)bounds.getY(),
               (float)bounds.getRight(), (float)bounds.getY(), 1.0f);

    // FX button strip
    auto fxStrip = bounds.removeFromLeft(36);
    g.setColour(GhostColours::border);
    g.drawLine((float)fxStrip.getRight(), (float)fxStrip.getY(),
               (float)fxStrip.getRight(), (float)fxStrip.getBottom(), 1.0f);
    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(10.0f, juce::Font::bold));

    // Draw FX vertically
    auto fxCentre = fxStrip.getCentre();
    g.saveState();
    g.addTransform(juce::AffineTransform::rotation(-juce::MathConstants<float>::halfPi,
                                                    (float)fxCentre.x, (float)fxCentre.y));
    g.drawText("FX", fxStrip, juce::Justification::centred);
    g.restoreState();

    // Divide remaining into sections
    int sectionW = bounds.getWidth() / 3;

    // Version History
    auto vhBounds = bounds.removeFromLeft(sectionW);
    drawVersionHistory(g, vhBounds);

    // Master Meter
    auto mmBounds = bounds.removeFromLeft(sectionW);
    drawMasterMeter(g, mmBounds);

    // Version Preview
    drawVersionPreview(g, bounds);
}

//==============================================================================
void SessionWorkspaceView::drawVersionHistory(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getRight(), (float)bounds.getY(),
               (float)bounds.getRight(), (float)bounds.getBottom(), 0.5f);

    int x = bounds.getX() + 14;
    int y = bounds.getY() + 10;

    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(8.0f, juce::Font::bold));
    g.drawText("VERSION HISTORY", x, y, 120, 12, juce::Justification::centredLeft);
    y += 18;

    // V5 label
    g.setColour(GhostColours::ghostPurple);
    g.setFont(juce::Font(22.0f, juce::Font::bold));
    g.drawText("V5", x, y, 30, 28, juce::Justification::centredLeft);

    // Avatars next to V5
    drawAvatar(g, x + 42, y + 14, 8, "A", GhostColours::ghostPurple);
    drawAvatar(g, x + 60, y + 14, 8, "M", GhostColours::audioTrack);
    y += 36;

    // Revert button
    auto revertBounds = juce::Rectangle<int>(x, y, 54, 20);
    g.setColour(GhostColours::surfaceLight);
    g.fillRoundedRectangle(revertBounds.toFloat(), 4.0f);
    g.setColour(GhostColours::border);
    g.drawRoundedRectangle(revertBounds.toFloat(), 4.0f, 1.0f);
    g.setColour(GhostColours::textSecondary);
    g.setFont(juce::Font(9.0f, juce::Font::bold));
    g.drawText("Revert", revertBounds, juce::Justification::centred);
}

//==============================================================================
void SessionWorkspaceView::drawGhostKeys(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getRight(), (float)bounds.getY(),
               (float)bounds.getRight(), (float)bounds.getBottom(), 0.5f);

    int x = bounds.getCentreX() - 55;
    int y = bounds.getY() + 10;

    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(8.0f, juce::Font::bold));
    g.drawText("GHOST KEYS", x, y, 110, 12, juce::Justification::centred);
    y += 16;

    // XY Pad
    ghostKeysArea = juce::Rectangle<int>(x, y, 110, 70);
    g.setColour(GhostColours::background);
    g.fillRoundedRectangle(ghostKeysArea.toFloat(), 6.0f);
    g.setColour(GhostColours::border);
    g.drawRoundedRectangle(ghostKeysArea.toFloat(), 6.0f, 1.0f);

    // Grid lines
    g.setColour(GhostColours::ghostPurple.withAlpha(0.15f));
    for (int i = 1; i < 3; ++i)
    {
        float gx = (float)ghostKeysArea.getX() + (float)ghostKeysArea.getWidth() * (float)i / 3.0f;
        g.drawLine(gx, (float)ghostKeysArea.getY(), gx, (float)ghostKeysArea.getBottom(), 0.5f);
        float gy = (float)ghostKeysArea.getY() + (float)ghostKeysArea.getHeight() * (float)i / 3.0f;
        g.drawLine((float)ghostKeysArea.getX(), gy, (float)ghostKeysArea.getRight(), gy, 0.5f);
    }

    // Glow
    float dotX = (float)ghostKeysArea.getX() + ghostKeysX * (float)ghostKeysArea.getWidth();
    float dotY = (float)ghostKeysArea.getY() + ghostKeysY * (float)ghostKeysArea.getHeight();
    juce::ColourGradient glow(GhostColours::ghostPurple.withAlpha(0.3f), dotX, dotY,
                               GhostColours::ghostPurple.withAlpha(0.0f), dotX + 30, dotY + 30, true);
    g.setGradientFill(glow);
    g.fillEllipse(dotX - 20, dotY - 20, 40, 40);

    // Dot
    g.setColour(GhostColours::ghostPurple.withAlpha(0.3f));
    g.fillEllipse(dotX - 6, dotY - 6, 12, 12);
    g.setColour(GhostColours::ghostPurple);
    g.drawEllipse(dotX - 6, dotY - 6, 12, 12, 2.0f);

    // Labels below
    y = ghostKeysArea.getBottom() + 4;
    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(7.0f));
    g.drawText("MOOD", ghostKeysArea.getX(), y, 36, 10, juce::Justification::centredLeft);
    g.drawText("TEXTURE", ghostKeysArea.getCentreX() - 18, y, 36, 10, juce::Justification::centred);
    g.drawText("MOVEMENT", ghostKeysArea.getRight() - 42, y, 42, 10, juce::Justification::centredRight);
}

//==============================================================================
void SessionWorkspaceView::drawEffectKnob(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getRight(), (float)bounds.getY(),
               (float)bounds.getRight(), (float)bounds.getBottom(), 0.5f);

    int cx = bounds.getCentreX();
    int y = bounds.getY() + 10;

    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(8.0f, juce::Font::bold));
    g.drawText("MELLOW VERB", bounds.getX(), y, bounds.getWidth(), 12, juce::Justification::centred);
    y += 18;

    // Knob
    int knobR = 26;
    knobArea = juce::Rectangle<int>(cx - knobR, y, knobR * 2, knobR * 2);

    // Outer ring background
    g.setColour(GhostColours::border);
    g.drawEllipse(knobArea.toFloat().reduced(2), 3.0f);

    // Value arc
    float startAngle = juce::MathConstants<float>::pi * 0.75f;
    float endAngle = juce::MathConstants<float>::pi * 2.25f;
    float valueAngle = startAngle + effectValue * (endAngle - startAngle);

    juce::Path arcPath;
    arcPath.addCentredArc((float)cx, (float)(y + knobR), (float)(knobR - 2), (float)(knobR - 2),
                          0.0f, startAngle, valueAngle, true);
    g.setColour(GhostColours::ghostPurple);
    g.strokePath(arcPath, juce::PathStrokeType(3.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    // Inner circle
    g.setColour(GhostColours::background);
    g.fillEllipse(knobArea.toFloat().reduced(8));
    g.setColour(GhostColours::border);
    g.drawEllipse(knobArea.toFloat().reduced(8), 1.0f);

    // Value text
    g.setColour(GhostColours::textSecondary);
    g.setFont(juce::Font(juce::Font::getDefaultMonospacedFontName(), 10.0f, juce::Font::plain));
    g.drawText(juce::String((int)(effectValue * 100)), knobArea, juce::Justification::centred);

    // Indicator line
    float indicatorAngle = startAngle + effectValue * (endAngle - startAngle) - juce::MathConstants<float>::halfPi;
    float ix = (float)cx + std::cos(indicatorAngle) * (float)(knobR - 10);
    float iy = (float)(y + knobR) + std::sin(indicatorAngle) * (float)(knobR - 10);
    float ix2 = (float)cx + std::cos(indicatorAngle) * (float)(knobR - 4);
    float iy2 = (float)(y + knobR) + std::sin(indicatorAngle) * (float)(knobR - 4);
    g.setColour(GhostColours::ghostPurple);
    g.drawLine(ix, iy, ix2, iy2, 2.0f);

    // DRY / WET labels
    y += knobR * 2 + 6;
    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(7.0f));
    g.drawText("DRY", cx - 28, y, 24, 10, juce::Justification::centred);
    g.drawText("WET", cx + 4, y, 24, 10, juce::Justification::centred);
}

//==============================================================================
void SessionWorkspaceView::drawMasterMeter(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    g.setColour(GhostColours::border);
    g.drawLine((float)bounds.getRight(), (float)bounds.getY(),
               (float)bounds.getRight(), (float)bounds.getBottom(), 0.5f);

    int cx = bounds.getCentreX();
    int y = bounds.getY() + 10;

    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(8.0f, juce::Font::bold));
    g.drawText("MASTER", bounds.getX(), y, bounds.getWidth(), 12, juce::Justification::centred);
    y += 18;

    // Two meter bars
    int meterH = 65;
    int meterW = 8;
    float levels[] = {0.65f, 0.58f};

    for (int ch = 0; ch < 2; ++ch)
    {
        int mx = cx - 8 + ch * 14;
        auto meterBounds = juce::Rectangle<int>(mx, y, meterW, meterH);

        // Background
        g.setColour(GhostColours::background);
        g.fillRoundedRectangle(meterBounds.toFloat(), 3.0f);
        g.setColour(GhostColours::border);
        g.drawRoundedRectangle(meterBounds.toFloat(), 3.0f, 1.0f);

        // Level fill (gradient from green to amber)
        int fillH = (int)(levels[ch] * (float)meterH);
        auto fillBounds = juce::Rectangle<int>(mx + 1, y + meterH - fillH, meterW - 2, fillH);
        juce::ColourGradient gradient(GhostColours::warningAmber, (float)fillBounds.getX(), (float)fillBounds.getY(),
                                       GhostColours::ghostGreen, (float)fillBounds.getX(), (float)fillBounds.getBottom(), false);
        g.setGradientFill(gradient);
        g.fillRoundedRectangle(fillBounds.toFloat(), 2.0f);
    }

    // dB label
    y += meterH + 6;
    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(juce::Font::getDefaultMonospacedFontName(), 8.0f, juce::Font::plain));
    g.drawText("-3.2 dB", bounds.getX(), y, bounds.getWidth(), 10, juce::Justification::centred);
}

//==============================================================================
void SessionWorkspaceView::drawVersionPreview(juce::Graphics& g, juce::Rectangle<int> bounds)
{
    int x = bounds.getX() + 14;
    int y = bounds.getY() + 10;

    g.setColour(GhostColours::textMuted);
    g.setFont(juce::Font(8.0f, juce::Font::bold));
    g.drawText("VERSION PREVIEW", x, y, 120, 12, juce::Justification::centredLeft);
    y += 18;

    // V4 label
    g.setColour(GhostColours::textSecondary);
    g.setFont(juce::Font(13.0f, juce::Font::bold));
    g.drawText("V4", x, y, 20, 16, juce::Justification::centredLeft);

    // Mini waveform
    auto wfBounds = juce::Rectangle<int>(x + 26, y, bounds.getWidth() - 50, 24);
    g.setColour(GhostColours::background);
    g.fillRoundedRectangle(wfBounds.toFloat(), 3.0f);
    g.setColour(GhostColours::border);
    g.drawRoundedRectangle(wfBounds.toFloat(), 3.0f, 1.0f);

    // Waveform bars
    float bx = (float)wfBounds.getX() + 2;
    float midY = (float)wfBounds.getCentreY();
    for (int i = 0; i < 40; ++i)
    {
        float h = (std::sin((float)i * 0.5f) * 0.3f + std::cos((float)i * 0.3f) * 0.2f + 0.5f) * (float)wfBounds.getHeight() * 0.4f;
        g.setColour(GhostColours::ghostPurple.withAlpha(0.5f));
        g.fillRect(bx, midY - h, 2.0f, h * 2.0f);
        bx += (float)(wfBounds.getWidth() - 4) / 40.0f;
    }

    y += 32;

    // Compare button
    auto compareBounds = juce::Rectangle<int>(x, y, 60, 20);
    g.setColour(GhostColours::ghostCyan.withAlpha(0.1f));
    g.fillRoundedRectangle(compareBounds.toFloat(), 4.0f);
    g.setColour(GhostColours::ghostCyan.withAlpha(0.3f));
    g.drawRoundedRectangle(compareBounds.toFloat(), 4.0f, 1.0f);
    g.setColour(GhostColours::ghostCyan);
    g.setFont(juce::Font(9.0f, juce::Font::bold));
    g.drawText("COMPARE", compareBounds, juce::Justification::centred);

    // Merge button
    auto mergeBounds = juce::Rectangle<int>(x + 66, y, 54, 20);
    g.setColour(GhostColours::ghostPurple.withAlpha(0.1f));
    g.fillRoundedRectangle(mergeBounds.toFloat(), 4.0f);
    g.setColour(GhostColours::ghostPurple.withAlpha(0.3f));
    g.drawRoundedRectangle(mergeBounds.toFloat(), 4.0f, 1.0f);
    g.setColour(GhostColours::ghostPurple);
    g.drawText("MERGE", mergeBounds, juce::Justification::centred);
}

//==============================================================================
void SessionWorkspaceView::drawAvatar(juce::Graphics& g, int cx, int cy, int radius,
                                       const juce::String& name, juce::Colour colour)
{
    float r = (float)radius;
    g.setColour(colour.withAlpha(0.15f));
    g.fillEllipse((float)cx - r, (float)cy - r, r * 2.0f, r * 2.0f);
    g.setColour(colour);
    g.drawEllipse((float)cx - r, (float)cy - r, r * 2.0f, r * 2.0f, 1.5f);

    g.setColour(colour);
    g.setFont(juce::Font(r * 0.9f, juce::Font::bold));
    g.drawText(name.substring(0, 1).toUpperCase(), (int)((float)cx - r), (int)((float)cy - r),
               (int)(r * 2.0f), (int)(r * 2.0f), juce::Justification::centred);
}

//==============================================================================
void SessionWorkspaceView::addChatMessage(const juce::String& author, const juce::String& text, juce::Colour c)
{
    chatMessages.push_back({author, text, c, 0});
    repaint();
}

//==============================================================================
void SessionWorkspaceView::mouseDown(const juce::MouseEvent& e)
{
    auto pos = e.getPosition();

    // Play button
    if (playButtonArea.contains(pos))
    {
        isPlaying = !isPlaying;
        repaint();
        return;
    }

    // Ghost Keys XY pad
    if (ghostKeysArea.contains(pos))
    {
        draggingGhostKeys = true;
        ghostKeysX = (float)(pos.x - ghostKeysArea.getX()) / (float)ghostKeysArea.getWidth();
        ghostKeysY = (float)(pos.y - ghostKeysArea.getY()) / (float)ghostKeysArea.getHeight();
        ghostKeysX = juce::jlimit(0.0f, 1.0f, ghostKeysX);
        ghostKeysY = juce::jlimit(0.0f, 1.0f, ghostKeysY);
        repaint();
        return;
    }

    // Effect knob
    if (knobArea.contains(pos))
    {
        draggingKnob = true;
        knobDragStartY = pos.y;
        knobDragStartVal = effectValue;
        return;
    }
}

void SessionWorkspaceView::mouseDrag(const juce::MouseEvent& e)
{
    auto pos = e.getPosition();

    if (draggingGhostKeys)
    {
        ghostKeysX = (float)(pos.x - ghostKeysArea.getX()) / (float)ghostKeysArea.getWidth();
        ghostKeysY = (float)(pos.y - ghostKeysArea.getY()) / (float)ghostKeysArea.getHeight();
        ghostKeysX = juce::jlimit(0.0f, 1.0f, ghostKeysX);
        ghostKeysY = juce::jlimit(0.0f, 1.0f, ghostKeysY);
        repaint();
        return;
    }

    if (draggingKnob)
    {
        float delta = (float)(knobDragStartY - pos.y) * 0.005f;
        effectValue = juce::jlimit(0.0f, 1.0f, knobDragStartVal + delta);
        repaint();
        return;
    }
}

void SessionWorkspaceView::mouseUp(const juce::MouseEvent&)
{
    draggingGhostKeys = false;
    draggingKnob = false;
}
