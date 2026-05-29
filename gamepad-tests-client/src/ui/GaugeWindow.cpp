#include "GaugeWindow.h"
#include "network/DataTypes.h"

#ifdef _WIN32
#undef WIN32_LEAN_AND_MEAN
#undef NOMINMAX
#include <windows.h>
#include <stdio.h>
#include <shellapi.h>
#endif

namespace gamepad {

static RateTestWindow* g_pTestWindow = nullptr;
static GaugeWindow* g_pGaugeWindow = nullptr;

static void setWindowTextUTF8(HWND hwnd, const char* utf8Str) {
    int len = MultiByteToWideChar(CP_UTF8, 0, utf8Str, -1, nullptr, 0);
    if (len > 0) {
        wchar_t* wstr = new wchar_t[len];
        MultiByteToWideChar(CP_UTF8, 0, utf8Str, -1, wstr, len);
        SetWindowTextW(hwnd, wstr);
        delete[] wstr;
    }
}

// ============= RateTestWindow Implementation =============

RateTestWindow::RateTestWindow()
    : hInstance_(nullptr)
    , hwnd_(nullptr)
    , visible_(false)
    , language_(Language::Chinese)
    , hTitle_(nullptr)
    , hRateDisplay_(nullptr)
    , hPacketsDisplay_(nullptr)
    , hMaxRateDisplay_(nullptr)
    , hAvgRateDisplay_(nullptr)
    , hProgressDisplay_(nullptr)
    , hResultDisplay_(nullptr)
    , hCloseBtn_(nullptr)
{
}

RateTestWindow::~RateTestWindow() {
    destroy();
}

LRESULT CALLBACK RateTestWindow::WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_CLOSE:
        if (g_pTestWindow) {
            g_pTestWindow->hide();
            if (g_pTestWindow->closeCallback_) {
                g_pTestWindow->closeCallback_();
            }
        }
        return 0;
    case WM_COMMAND:
        if (LOWORD(wParam) == 100 && g_pTestWindow) {
            g_pTestWindow->hide();
            if (g_pTestWindow->closeCallback_) {
                g_pTestWindow->closeCallback_();
            }
        }
        return 0;
    default:
        return DefWindowProc(hwnd, msg, wParam, lParam);
    }
}

bool RateTestWindow::create(HINSTANCE hInstance) {
    hInstance_ = hInstance;

    // 设置 Per-Monitor DPI awareness
    typedef HRESULT(WINAPI *SetProcessDpiAwareness_t)(int);
    HMODULE shcore = LoadLibraryW(L"shcore.dll");
    if (shcore) {
        SetProcessDpiAwareness_t SetProcessDpiAwareness = (SetProcessDpiAwareness_t)GetProcAddress(shcore, "SetProcessDpiAwareness");
        if (SetProcessDpiAwareness) {
            SetProcessDpiAwareness(2);
        }
        FreeLibrary(shcore);
    }

    HDC hdc = GetDC(nullptr);
    int dpiX = GetDeviceCaps(hdc, LOGPIXELSX);
    ReleaseDC(nullptr, hdc);
    float scaleFactor = dpiX / 96.0f;

    const wchar_t CLASS_NAME[] = L"RateTestWindow";

    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(WNDCLASSEXW);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground = CreateSolidBrush(RGB(30, 30, 35));
    wc.lpszClassName = CLASS_NAME;

    if (!RegisterClassExW(&wc)) {
        return false;
    }

    int screenW = GetSystemMetrics(SM_CXSCREEN);
    int screenH = GetSystemMetrics(SM_CYSCREEN);
    int scaledWidth = (int)(WINDOW_WIDTH * scaleFactor);
    int scaledHeight = (int)(WINDOW_HEIGHT * scaleFactor);
    int x = (screenW - scaledWidth) / 2;
    int y = (screenH - scaledHeight) / 2;

    hwnd_ = CreateWindowExW(
        0, CLASS_NAME, L"\u56DE\u62A5\u7387\u6D4B\u8BD5",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
        x, y, scaledWidth, scaledHeight,
        nullptr, nullptr, hInstance, nullptr
    );

    if (!hwnd_) {
        return false;
    }

    int fontSize = (int)(-14 * scaleFactor);
    HFONT hFont = CreateFontW(fontSize, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
        DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
        CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, L"Microsoft YaHei UI");

    hTitle_ = CreateWindowExW(0, L"STATIC", L"\u56DE\u62A5\u7387\u6D4B\u8BD5",
        WS_CHILD | WS_VISIBLE | SS_CENTER,
        (int)(10*scaleFactor), (int)(10*scaleFactor), (int)(360*scaleFactor), (int)(30*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hTitle_, WM_SETFONT, (WPARAM)hFont, 0);

    hRateDisplay_ = CreateWindowExW(0, L"STATIC", L"\u62A5\u7387: -- Hz",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(50*scaleFactor), (int)(360*scaleFactor), (int)(25*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hRateDisplay_, WM_SETFONT, (WPARAM)hFont, 0);

    hPacketsDisplay_ = CreateWindowExW(0, L"STATIC", L"\u5305\u6570: 0/s",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(80*scaleFactor), (int)(360*scaleFactor), (int)(25*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hPacketsDisplay_, WM_SETFONT, (WPARAM)hFont, 0);

    hMaxRateDisplay_ = CreateWindowExW(0, L"STATIC", L"\u6700\u9AD8: 0 Hz",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(110*scaleFactor), (int)(360*scaleFactor), (int)(25*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hMaxRateDisplay_, WM_SETFONT, (WPARAM)hFont, 0);

    hAvgRateDisplay_ = CreateWindowExW(0, L"STATIC", L"\u5E73\u5747: 0 Hz",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(140*scaleFactor), (int)(360*scaleFactor), (int)(25*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hAvgRateDisplay_, WM_SETFONT, (WPARAM)hFont, 0);

    hProgressDisplay_ = CreateWindowExW(0, L"STATIC", L"\u6D4B\u8BD5\u4E2D 500Hz...",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(175*scaleFactor), (int)(360*scaleFactor), (int)(25*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hProgressDisplay_, WM_SETFONT, (WPARAM)hFont, 0);

    hResultDisplay_ = CreateWindowExW(0, L"STATIC", L"",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(205*scaleFactor), (int)(360*scaleFactor), (int)(25*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hResultDisplay_, WM_SETFONT, (WPARAM)hFont, 0);

    hCloseBtn_ = CreateWindowExW(0, L"BUTTON", 
        language_ == Language::Chinese ? L"\u5173\u95ED" : L"Close",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        150, 330, 100, 30, hwnd_, (HMENU)100, hInstance, nullptr);
    SendMessageW(hCloseBtn_, WM_SETFONT, (WPARAM)hFont, 0);

    g_pTestWindow = this;
    return true;
}

void RateTestWindow::show() {
    if (hwnd_) {
        ShowWindow(hwnd_, SW_SHOW);
        visible_ = true;
        UpdateWindow(hwnd_);
        refreshTexts();
    }
}

void RateTestWindow::hide() {
    if (hwnd_) {
        ShowWindow(hwnd_, SW_HIDE);
        visible_ = false;
    }
}

void RateTestWindow::destroy() {
    if (hwnd_) {
        DestroyWindow(hwnd_);
        hwnd_ = nullptr;
        visible_ = false;
    }
}

bool RateTestWindow::processMessages() {
    MSG msg;
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
        if (msg.message == WM_QUIT) {
            return false;
        }
        if (!visible_ || !IsDialogMessageW(hwnd_, &msg)) {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
    return true;
}

void RateTestWindow::updateRate(int hz, int packetsPerSec, int maxRate, int avgRate) {
    if (hRateDisplay_) {
        wchar_t buf[64];
        if (language_ == Language::Chinese) {
            swprintf(buf, sizeof(buf), L"\u9891\u7387: %d Hz", hz);
        } else {
            swprintf(buf, sizeof(buf), L"Rate: %d Hz", hz);
        }
        SetWindowTextW(hRateDisplay_, buf);
    }
    if (hPacketsDisplay_) {
        wchar_t buf[64];
        if (language_ == Language::Chinese) {
            swprintf(buf, sizeof(buf), L"\u5305\u6570/s: %d", packetsPerSec);
        } else {
            swprintf(buf, sizeof(buf), L"Packets/s: %d", packetsPerSec);
        }
        SetWindowTextW(hPacketsDisplay_, buf);
    }
    if (hMaxRateDisplay_) {
        wchar_t buf[64];
        if (language_ == Language::Chinese) {
            swprintf(buf, sizeof(buf), L"\u6700\u9AD8: %d Hz", maxRate);
        } else {
            swprintf(buf, sizeof(buf), L"Max: %d Hz", maxRate);
        }
        SetWindowTextW(hMaxRateDisplay_, buf);
    }
    if (hAvgRateDisplay_) {
        wchar_t buf[64];
        if (language_ == Language::Chinese) {
            swprintf(buf, sizeof(buf), L"\u5E73\u5747: %d Hz", avgRate);
        } else {
            swprintf(buf, sizeof(buf), L"Avg: %d Hz", avgRate);
        }
        SetWindowTextW(hAvgRateDisplay_, buf);
    }
}

void RateTestWindow::updateProgress(const char* progress) {
    if (hProgressDisplay_) {
        setWindowTextUTF8(hProgressDisplay_, progress);
    }
}

void RateTestWindow::updateResult(const char* result) {
    if (hResultDisplay_) {
        setWindowTextUTF8(hResultDisplay_, result);
    }
}

void RateTestWindow::refreshTexts() {
    if (!hwnd_) return;
    
    if (language_ == Language::Chinese) {
        setWindowTextUTF8(hwnd_, "\u56DE\u62A5\u7387\u6D4B\u8BD5");
        setWindowTextUTF8(hTitle_, "\u56DE\u62A5\u7387\u6D4B\u8BD5");
        setWindowTextUTF8(hCloseBtn_, "\u5173\u95ED");
    } else {
        setWindowTextUTF8(hwnd_, "Rate Test");
        setWindowTextUTF8(hTitle_, "Rate Test");
        SetWindowTextW(hCloseBtn_, L"Close");
    }
}

// ============= GaugeWindow Implementation =============

GaugeWindow::GaugeWindow()
    : hwnd_(nullptr)
    , hInstance_(nullptr)
    , running_(false)
    , connected_(false)
    , sampleRate_(0.0f)
    , pitch_(0.0f), yaw_(0.0f), roll_(0.0f)
    , ax_(0.0f), ay_(0.0f), az_(0.0f)
    , language_(Language::Chinese)
    , hTitle_(nullptr), hStatus_(nullptr), hSampleRate_(nullptr)
    , hGyroLabel_(nullptr), hPitchLabel_(nullptr), hPitchValue_(nullptr)
    , hYawLabel_(nullptr), hYawValue_(nullptr), hRollLabel_(nullptr), hRollValue_(nullptr)
    , hAccelLabel_(nullptr), hAxLabel_(nullptr), hAxValue_(nullptr)
    , hAyLabel_(nullptr), hAyValue_(nullptr), hAzLabel_(nullptr), hAzValue_(nullptr)
    , hLangBtn_(nullptr), hLink_(nullptr), hVersion_(nullptr)
    , hTestBtn_(nullptr), hTestResult_(nullptr), hTestProgress_(nullptr)
{
}

GaugeWindow::~GaugeWindow() {
    if (hwnd_) {
        DestroyWindow(hwnd_);
    }
}

void GaugeWindow::updateTexts() {
    if (!hwnd_) return;

    if (language_ == Language::Chinese) {
        setWindowTextUTF8(hTitle_, "\u624B\u67C4\u6D4B\u8BD5\u5BA2\u6237\u7AEF");
        setWindowTextUTF8(hGyroLabel_, "\u964D\u8F6C\u4F20\u611F\u5668");
        setWindowTextUTF8(hAccelLabel_, "\u52A0\u901F\u5EA6\u8BA1\u4F20\u611F\u5668");
        setWindowTextUTF8(hLangBtn_, "EN");
        setWindowTextUTF8(hVersion_, "Gamepad Test Client v1.0 - @Kezry");
        if (hTestBtn_) {
            setWindowTextUTF8(hTestBtn_, "\u56DE\u62A5\u7387\u6D4B\u8BD5");
        }
        testWindow_.setLanguage(Language::Chinese);
    } else {
        setWindowTextUTF8(hTitle_, "Gamepad Test Client");
        setWindowTextUTF8(hGyroLabel_, "Gyroscope");
        setWindowTextUTF8(hAccelLabel_, "Accelerometer");
        setWindowTextUTF8(hLangBtn_, "\u4E2D");
        setWindowTextUTF8(hVersion_, "Gamepad Test Client v1.0 - @Kezry");
        if (hTestBtn_) {
            setWindowTextUTF8(hTestBtn_, "Test Rate");
        }
        testWindow_.setLanguage(Language::English);
    }
}

void GaugeWindow::updateValues(const GyroData& gyroData, float sampleRate, bool connected, bool wsConnected) {
    pitch_ = gyroData.pitch;
    yaw_ = gyroData.yaw;
    roll_ = gyroData.roll;
    ax_ = gyroData.ax;
    ay_ = gyroData.ay;
    az_ = gyroData.az;
    sampleRate_ = sampleRate;
    connected_ = connected;

    wchar_t buf[64];

    if (language_ == Language::Chinese) {
        if (connected) {
            setWindowTextUTF8(hStatus_, "\u5DF2\u8FDE\u63A5");
        } else {
            setWindowTextUTF8(hStatus_, "\u672A\u8FDE\u63A5");
        }
        swprintf(buf, sizeof(buf), L"\u91C7\u6837\u7387: %.0f Hz", sampleRate);
    } else {
        if (connected) {
            setWindowTextUTF8(hStatus_, "Connected");
        } else {
            setWindowTextUTF8(hStatus_, "Disconnected");
        }
        swprintf(buf, sizeof(buf), L"Sample Rate: %.0f Hz", sampleRate);
    }
    SetWindowTextW(hSampleRate_, buf);

    swprintf(buf, sizeof(buf), L"%.2f deg/s", pitch_);
    SetWindowTextW(hPitchValue_, buf);

    swprintf(buf, sizeof(buf), L"%.2f deg/s", yaw_);
    SetWindowTextW(hYawValue_, buf);

    swprintf(buf, sizeof(buf), L"%.2f deg/s", roll_);
    SetWindowTextW(hRollValue_, buf);

    swprintf(buf, sizeof(buf), L"%.4f g", ax_);
    SetWindowTextW(hAxValue_, buf);

    swprintf(buf, sizeof(buf), L"%.4f g", ay_);
    SetWindowTextW(hAyValue_, buf);

    swprintf(buf, sizeof(buf), L"%.4f g", az_);
    SetWindowTextW(hAzValue_, buf);

    if (!wsConnected && hLink_) {
        ShowWindow(hLink_, SW_SHOW);
    } else if (hLink_) {
        ShowWindow(hLink_, SW_HIDE);
    }

    wchar_t title[128];
    if (language_ == Language::Chinese) {
        const wchar_t* status = connected ? L"\u5DF2\u8FDE\u63A5" : L"\u672A\u8FDE\u63A5";
        swprintf(title, sizeof(title), L"\u624B\u67C4\u6D4B\u8BD5\u5BA2\u6237\u7AEF - %s | %.0f Hz", status, sampleRate);
    } else {
        const wchar_t* status = connected ? L"Connected" : L"Disconnected";
        swprintf(title, sizeof(title), L"Gamepad Test Client - %s | %.0f Hz", status, sampleRate);
    }
    SetWindowTextW(hwnd_, title);
}

void GaugeWindow::updateTestProgress(const char* progress) {
    if (hTestProgress_) {
        setWindowTextUTF8(hTestProgress_, progress);
    }
}

void GaugeWindow::updateTestResult(const char* result) {
    if (hTestResult_) {
        setWindowTextUTF8(hTestResult_, result);
    }
}

void GaugeWindow::setTestCallback(std::function<void()> callback) {
    testCallback_ = callback;
}

void GaugeWindow::processTestButton() {
    if (testCallback_) {
        testCallback_();
    }
}

LRESULT CALLBACK GaugeWindow::WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_CTLCOLORSTATIC:
    {
        HDC hdcStatic = (HDC)wParam;
        SetTextColor(hdcStatic, RGB(255, 255, 255));
        SetBkColor(hdcStatic, RGB(30, 30, 35));
        return (INT_PTR)CreateSolidBrush(RGB(30, 30, 35));
    }
    case WM_CLOSE:
    {
        // 关闭控制台窗口
        HWND consoleWnd = GetConsoleWindow();
        if (consoleWnd) {
            PostMessageW(consoleWnd, WM_CLOSE, 0, 0);
        }
        DestroyWindow(hwnd);
        return 0;
    }
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    case WM_COMMAND:
        if (g_pGaugeWindow) {
            if (LOWORD(wParam) == 100) {
                if (g_pGaugeWindow->getLanguage() == Language::Chinese) {
                    g_pGaugeWindow->setLanguage(Language::English);
                } else {
                    g_pGaugeWindow->setLanguage(Language::Chinese);
                }
            } else if (LOWORD(wParam) == 101 && HIWORD(wParam) == STN_CLICKED) {
                ShellExecuteW(nullptr, L"open", L"https://gamepad-test-pro.molecbot.com/", nullptr, nullptr, SW_SHOWNORMAL);
            } else if (LOWORD(wParam) == 200) {
                g_pGaugeWindow->processTestButton();
            }
        }
        return 0;
    default:
        return DefWindowProc(hwnd, msg, wParam, lParam);
    }
}

bool GaugeWindow::create(HINSTANCE hInstance, int nCmdShow) {
    hInstance_ = hInstance;

    // 设置 Per-Monitor DPI awareness
    typedef HRESULT(WINAPI *SetProcessDpiAwareness_t)(int);
    HMODULE shcore = LoadLibraryW(L"shcore.dll");
    if (shcore) {
        SetProcessDpiAwareness_t SetProcessDpiAwareness = (SetProcessDpiAwareness_t)GetProcAddress(shcore, "SetProcessDpiAwareness");
        if (SetProcessDpiAwareness) {
            SetProcessDpiAwareness(2);
        }
        FreeLibrary(shcore);
    }

    HDC hdc = GetDC(nullptr);
    int dpiX = GetDeviceCaps(hdc, LOGPIXELSX);
    ReleaseDC(nullptr, hdc);
    float scaleFactor = dpiX / 96.0f;

    const wchar_t CLASS_NAME[] = L"GamepadGaugeWindow";

    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(WNDCLASSEXW);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground = CreateSolidBrush(RGB(30, 30, 35));
    wc.lpszClassName = CLASS_NAME;
    wc.hIcon = LoadIconW(nullptr, IDI_APPLICATION);

    if (!RegisterClassExW(&wc)) {
        return false;
    }

    int screenW = GetSystemMetrics(SM_CXSCREEN);
    int screenH = GetSystemMetrics(SM_CYSCREEN);
    int scaledWidth = (int)(WINDOW_WIDTH * scaleFactor);
    int scaledHeight = (int)(WINDOW_HEIGHT * scaleFactor);
    int x = (screenW - scaledWidth) / 2;
    int y = (screenH - scaledHeight) / 2;

    hwnd_ = CreateWindowExW(
        0, CLASS_NAME, L"Gamepad Test Client",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
        x, y, scaledWidth, scaledHeight,
        nullptr, nullptr, hInstance, nullptr
    );

    if (!hwnd_) {
        return false;
    }

    int fontSize = (int)(-14 * scaleFactor);
    HFONT hFont = CreateFontW(fontSize, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
        DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
        CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, L"Microsoft YaHei UI");

    hTitle_ = CreateWindowExW(0, L"STATIC", L"Gamepad Test Client",
        WS_CHILD | WS_VISIBLE | SS_CENTER,
        (int)(10*scaleFactor), (int)(10*scaleFactor), (int)(420*scaleFactor), (int)(30*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hTitle_, WM_SETFONT, (WPARAM)hFont, 0);

    hStatus_ = CreateWindowExW(0, L"STATIC", L"Disconnected",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(45*scaleFactor), (int)(120*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hStatus_, WM_SETFONT, (WPARAM)hFont, 0);

    hSampleRate_ = CreateWindowExW(0, L"STATIC", L"Sample Rate: 0 Hz",
        WS_CHILD | WS_VISIBLE,
        (int)(130*scaleFactor), (int)(45*scaleFactor), (int)(150*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hSampleRate_, WM_SETFONT, (WPARAM)hFont, 0);

    hLangBtn_ = CreateWindowExW(0, L"BUTTON", L"EN",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        (int)(400*scaleFactor), (int)(42*scaleFactor), (int)(50*scaleFactor), (int)(25*scaleFactor), hwnd_, (HMENU)100, hInstance, nullptr);
    SendMessageW(hLangBtn_, WM_SETFONT, (WPARAM)hFont, 0);

    hLink_ = CreateWindowExW(0, L"STATIC", L"https://gamepad-test-pro.molecbot.com",
        WS_CHILD | SS_CENTER | WS_TABSTOP | SS_NOTIFY,
        (int)(10*scaleFactor), (int)(70*scaleFactor), (int)(420*scaleFactor), (int)(20*scaleFactor), hwnd_, (HMENU)101, hInstance, nullptr);
    SendMessageW(hLink_, WM_SETFONT, (WPARAM)hFont, 0);
    ShowWindow(hLink_, SW_HIDE);

    hGyroLabel_ = CreateWindowExW(0, L"STATIC", L"Gyroscope",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(100*scaleFactor), (int)(200*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hGyroLabel_, WM_SETFONT, (WPARAM)hFont, 0);

    hPitchLabel_ = CreateWindowExW(0, L"STATIC", L"Pitch:",
        WS_CHILD | WS_VISIBLE,
        (int)(20*scaleFactor), (int)(125*scaleFactor), (int)(60*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hPitchLabel_, WM_SETFONT, (WPARAM)hFont, 0);

    hPitchValue_ = CreateWindowExW(0, L"STATIC", L"0.00 deg/s",
        WS_CHILD | WS_VISIBLE,
        (int)(80*scaleFactor), (int)(125*scaleFactor), (int)(150*scaleFactor), (int)(20*scaleFactor), hwnd_, (HMENU)1, hInstance, nullptr);
    SendMessageW(hPitchValue_, WM_SETFONT, (WPARAM)hFont, 0);

    hYawLabel_ = CreateWindowExW(0, L"STATIC", L"Yaw:",
        WS_CHILD | WS_VISIBLE,
        (int)(20*scaleFactor), (int)(150*scaleFactor), (int)(60*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hYawLabel_, WM_SETFONT, (WPARAM)hFont, 0);

    hYawValue_ = CreateWindowExW(0, L"STATIC", L"0.00 deg/s",
        WS_CHILD | WS_VISIBLE,
        (int)(80*scaleFactor), (int)(150*scaleFactor), (int)(150*scaleFactor), (int)(20*scaleFactor), hwnd_, (HMENU)2, hInstance, nullptr);
    SendMessageW(hYawValue_, WM_SETFONT, (WPARAM)hFont, 0);

    hRollLabel_ = CreateWindowExW(0, L"STATIC", L"Roll:",
        WS_CHILD | WS_VISIBLE,
        (int)(20*scaleFactor), (int)(175*scaleFactor), (int)(60*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hRollLabel_, WM_SETFONT, (WPARAM)hFont, 0);

    hRollValue_ = CreateWindowExW(0, L"STATIC", L"0.00 deg/s",
        WS_CHILD | WS_VISIBLE,
        (int)(80*scaleFactor), (int)(175*scaleFactor), (int)(150*scaleFactor), (int)(20*scaleFactor), hwnd_, (HMENU)3, hInstance, nullptr);
    SendMessageW(hRollValue_, WM_SETFONT, (WPARAM)hFont, 0);

    hAccelLabel_ = CreateWindowExW(0, L"STATIC", L"Accelerometer",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(210*scaleFactor), (int)(200*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hAccelLabel_, WM_SETFONT, (WPARAM)hFont, 0);

    hAxLabel_ = CreateWindowExW(0, L"STATIC", L"AX:",
        WS_CHILD | WS_VISIBLE,
        (int)(20*scaleFactor), (int)(235*scaleFactor), (int)(60*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hAxLabel_, WM_SETFONT, (WPARAM)hFont, 0);

    hAxValue_ = CreateWindowExW(0, L"STATIC", L"0.0000 g",
        WS_CHILD | WS_VISIBLE,
        (int)(80*scaleFactor), (int)(235*scaleFactor), (int)(150*scaleFactor), (int)(20*scaleFactor), hwnd_, (HMENU)4, hInstance, nullptr);
    SendMessageW(hAxValue_, WM_SETFONT, (WPARAM)hFont, 0);

    hAyLabel_ = CreateWindowExW(0, L"STATIC", L"AY:",
        WS_CHILD | WS_VISIBLE,
        (int)(20*scaleFactor), (int)(260*scaleFactor), (int)(60*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hAyLabel_, WM_SETFONT, (WPARAM)hFont, 0);

    hAyValue_ = CreateWindowExW(0, L"STATIC", L"0.0000 g",
        WS_CHILD | WS_VISIBLE,
        (int)(80*scaleFactor), (int)(260*scaleFactor), (int)(150*scaleFactor), (int)(20*scaleFactor), hwnd_, (HMENU)5, hInstance, nullptr);
    SendMessageW(hAyValue_, WM_SETFONT, (WPARAM)hFont, 0);

    hAzLabel_ = CreateWindowExW(0, L"STATIC", L"AZ:",
        WS_CHILD | WS_VISIBLE,
        (int)(20*scaleFactor), (int)(285*scaleFactor), (int)(60*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hAzLabel_, WM_SETFONT, (WPARAM)hFont, 0);

    hAzValue_ = CreateWindowExW(0, L"STATIC", L"0.0000 g",
        WS_CHILD | WS_VISIBLE,
        (int)(80*scaleFactor), (int)(285*scaleFactor), (int)(150*scaleFactor), (int)(20*scaleFactor), hwnd_, (HMENU)6, hInstance, nullptr);
    SendMessageW(hAzValue_, WM_SETFONT, (WPARAM)hFont, 0);

    hTestBtn_ = CreateWindowExW(0, L"BUTTON", 
        language_ == Language::Chinese ? L"\u56DE\u62A5\u7387\u6D4B\u8BD5" : L"Test Rate",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        (int)(350*scaleFactor), (int)(100*scaleFactor), (int)(80*scaleFactor), (int)(25*scaleFactor), hwnd_, (HMENU)200, hInstance, nullptr);
    SendMessageW(hTestBtn_, WM_SETFONT, (WPARAM)hFont, 0);

    hTestProgress_ = CreateWindowExW(0, L"STATIC", L"",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(310*scaleFactor), (int)(420*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hTestProgress_, WM_SETFONT, (WPARAM)hFont, 0);

    hTestResult_ = CreateWindowExW(0, L"STATIC", L"",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(330*scaleFactor), (int)(420*scaleFactor), (int)(20*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hTestResult_, WM_SETFONT, (WPARAM)hFont, 0);

    hVersion_ = CreateWindowExW(0, L"STATIC", L"Gamepad Test Client v1.0 - @Kezry",
        WS_CHILD | WS_VISIBLE,
        (int)(10*scaleFactor), (int)(370*scaleFactor), (int)(460*scaleFactor), (int)(25*scaleFactor), hwnd_, nullptr, hInstance, nullptr);
    SendMessageW(hVersion_, WM_SETFONT, (WPARAM)hFont, 0);

    // 创建测试窗口
    testWindow_.create(hInstance);

    g_pGaugeWindow = this;
    ShowWindow(hwnd_, nCmdShow);
    UpdateWindow(hwnd_);

    updateTexts();
    running_ = true;

    return true;
}

void GaugeWindow::show() {
    ShowWindow(hwnd_, SW_SHOWNORMAL);
    UpdateWindow(hwnd_);
}

void GaugeWindow::update(const GyroData& gyroData, float sampleRate, bool connected, bool wsConnected) {
    pitch_ = gyroData.pitch;
    yaw_ = gyroData.yaw;
    roll_ = gyroData.roll;
    ax_ = gyroData.ax;
    ay_ = gyroData.ay;
    az_ = gyroData.az;
    sampleRate_ = sampleRate;
    connected_ = connected;

    updateValues(gyroData, sampleRate, connected, wsConnected);
}

bool GaugeWindow::processMessages() {
    MSG msg;
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
        if (msg.message == WM_QUIT) {
            running_ = false;
            return false;
        }
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
        
        // 处理测试窗口消息
        if (testWindow_.isVisible()) {
            if (!testWindow_.processMessages()) {
                return running_;
            }
        }
    }
    return running_;
}

}  // namespace gamepad
