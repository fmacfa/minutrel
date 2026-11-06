# The mini timer

Choose an authorised **Minutrel project**. The selector never browses folders or monitors files on your computer.

## Desktop

Open **Mini timer**, use the menu bar/system tray icon, or try `Ctrl/Cmd + Alt + M`. The movable widget stays above ordinary windows and offers a project, optional task, start, pause, resume and finish.

Its height follows the content. Closing the widget releases that window; the system icon can create it again. **Minutrel** brings back the main window. Closing the main window hides it; **Quit** exits the client. Neither action finishes a personal or server timer. Finish it explicitly.

The native client shares its Rust session and one SSE connection across windows. The counter is local and sends no request every second. The widget does not load history or reports.

Keyboard shortcuts and placement depend on system support. Linux/Wayland desktops and full-screen apps can impose their own rules; field testing is still needed on all three platforms.

![Standalone mini timer, French interface](screenshots/14-widget-autonome.png)

The widget also works without a server in the personal workspace. Team accounts keep offline timer actions in the local outbox, with waiting and conflict states shown explicitly.

## Browser

An integrated compact timer remains accessible while navigating. A separate mini window is offered when Document Picture-in-Picture is available. Otherwise, use the integrated bar. Closing the page does not finish a timer on the server.

## States

The app distinguishes idle, running, paused, local storage, waiting to sync, offline and conflict states. The server allows one active timer per member. Several offline devices may propose incompatible histories; synchronisation refuses them without replacing accepted history. Read [synchronisation](SYNCHRONISATION.md).
