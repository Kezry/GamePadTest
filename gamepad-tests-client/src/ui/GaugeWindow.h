#pragma once

#ifdef ERROR
#undef ERROR
#endif

#include <windows.h>
#include <string>
#include <functional>
#include "network/DataTypes.h"

namespace gamepad {

enum class Language {
    Chinese,
    English
};

class RateTestWindow {
public:
    RateTestWindow();
    ~RateTestWindow();

    bool create(HINSTANCE hInstance);
    void show();
    void hide();
    void destroy();
    bool isVisible() const { return visible_; }
    bool processMessages();
    void setLanguage(Language lang) { language_ = lang; refreshTexts(); }
    void refreshTexts();
    void updateRate(int hz, int packetsPerSec, int maxRate, int avgRate);
    void updateProgress(const char* progress);
    void updateResult(const char* result);
    void setCloseCallback(std::function<void()> cb) { closeCallback_ = cb; }

private:
    static constexpr int WINDOW_WIDTH = 450;
    static constexpr int WINDOW_HEIGHT = 420;

    static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);

    HINSTANCE hInstance_;
    HWND hwnd_;
    bool visible_;
    Language language_;
    std::function<void()> closeCallback_;

    HWND hTitle_;
    HWND hRateDisplay_;
    HWND hPacketsDisplay_;
    HWND hMaxRateDisplay_;
    HWND hAvgRateDisplay_;
    HWND hProgressDisplay_;
    HWND hResultDisplay_;
    HWND hCloseBtn_;
};

class GaugeWindow {
public:
    GaugeWindow();
    ~GaugeWindow();

    bool create(HINSTANCE hInstance, int nCmdShow);
    HWND getHWND() const { return hwnd_; }
    void show();
    void update(const GyroData& gyroData, float sampleRate, bool connected, bool wsConnected);
    void updateTestProgress(const char* progress);
    void updateTestResult(const char* result);
    void setTestCallback(std::function<void()> callback);
    void processTestButton();
    bool processMessages();
    bool isRunning() const { return running_; }
    void setLanguage(Language lang) { language_ = lang; updateTexts(); }
    Language getLanguage() const { return language_; }
    RateTestWindow& getTestWindow() { return testWindow_; }

private:
    static constexpr int WINDOW_WIDTH = 480;
    static constexpr int WINDOW_HEIGHT = 400;

    void updateTexts();
    void updateValues(const GyroData& gyroData, float sampleRate, bool connected, bool wsConnected);

    static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);

    HWND hwnd_;
    HINSTANCE hInstance_;
    bool running_;
    bool connected_;
    float sampleRate_;
    float pitch_, yaw_, roll_;
    float ax_, ay_, az_;
    Language language_;
    RateTestWindow testWindow_;

    HWND hTitle_;
    HWND hStatus_;
    HWND hSampleRate_;
    HWND hGyroLabel_;
    HWND hPitchLabel_, hPitchValue_;
    HWND hYawLabel_, hYawValue_;
    HWND hRollLabel_, hRollValue_;
    HWND hAccelLabel_;
    HWND hAxLabel_, hAxValue_;
    HWND hAyLabel_, hAyValue_;
    HWND hAzLabel_, hAzValue_;
    HWND hLangBtn_;
    HWND hLink_;
    HWND hVersion_;
    HWND hTestBtn_;
    HWND hTestResult_;
    HWND hTestProgress_;
    std::function<void()> testCallback_;
};

}  // namespace gamepad
