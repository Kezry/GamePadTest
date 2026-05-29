cmake_minimum_required(VERSION 3.16)
project(gamepad-test-client LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(gamepad-test-client
    src/main.cpp
    src/platform/WindowsHIDDevice.cpp
    src/network/WebSocketServer.cpp
    src/utils/HidHideIntegration.cpp
    src/ui/GaugeWindow.cpp
)

target_include_directories(gamepad-test-client PRIVATE src)

if(WIN32)
    # Enable Unicode for Win32 API (fixes IDC_ARROW/IDI_APPLICATION type mismatch)
    target_compile_definitions(gamepad-test-client PRIVATE UNICODE _UNICODE)

    target_link_libraries(gamepad-test-client PRIVATE
        setupapi
        hid
        ws2_32
        crypt32
        gdi32
        comctl32
    )
    # Console subsystem so both GUI and --console modes work
    set_target_properties(gamepad-test-client PROPERTIES
        WIN32_EXECUTABLE OFF
    )
endif()
