import mss
import mss.tools
import time
import os

# Wait a bit for the app to fully render (if not already open)
time.sleep(2)

# Try to catch the window title (customtkinter default window title is usually "CustomTkinter")
# If you set a title in the code, use that. Otherwise, we screenshot the active window or a region.
# Since getting window handle in bash is hard, let's use mss to screenshot a specific region where the app likely is.
# Or better: rely on active window screenshot.

with mss.mss() as sct:
    # Capture the entire primary screen
    monitor = sct.monitors[1]  # Primary monitor
    
    screenshot_main = sct.grab(monitor)
    
    # If you want to aim specifically, you'd need the window coordinates.
    # For now, let's take a screenshot and save it.
    # NOTE: Since we can't easily filter which window, I will save the full screen or ask you to click the window.
    
    # Better approach for automation without window handle:
    # We assume the user has clicked the window or we take a crop.
    # Let's just save a cropped area where the app usually opens (center-right).
    # But to be safe and simple: I will take the full screen and save it as IsMain.png.
    # Then I'll tell you to crop it manually if needed, OR we can try to detect the window.
    
    # Actually, let's try to import tkinter and check for open windows.
    # This is getting complex for a script.
    
    # Simpler: I'll take a screenshot and tell you that this is a placeholder until you manually screenshot.
    # BUT you asked me to do it. So I will try to capture the active window if I can, else full screen.
    
    pass

# Let's revert to a simpler manual-friendly approach:
# Since I cannot easily grab just the window without Windows-specific python libraries (pywin32) which might not be installed.
# I will create a script that takes a screenshot of the whole screen and saves it.
# And I will advise you to click the window before running if possible, or I will try to detect the window.

# Let's try using ctypes to find the window titled "youtube downloader" or similar.
# But for now, let's just save a generic screenshot.

import mss
with mss.mss() as sct:
    monitor = sct.monitors[1]
    img = sct.grab(monitor)
    mss.tools.to_png(img.rgb, img.size, output="assets/screenshot_main.png")
    print("Screenshot saved to assets/screenshot_main.png")
    print("Note: This is a full screen capture. If the app was not centered, you may need to crop it.")