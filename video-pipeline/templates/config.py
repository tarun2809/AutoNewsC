# Video Template Configuration

## Default Template Settings

TEMPLATE_CONFIG = {
    "default": {
        "background_color": "#1a1a1a",
        "title_font": "Arial Bold",
        "title_size": 72,
        "title_color": "#ffffff",
        "subtitle_font": "Arial",
        "subtitle_size": 32,
        "subtitle_color": "#e0e0e0",
        "text_font": "Arial",
        "text_size": 24,
        "text_color": "#ffffff",
        "accent_color": "#3b82f6",
        "animation_duration": 1.0,
        "transition_duration": 0.5,
    },
    "news": {
        "background_color": "#0f172a",
        "title_font": "Arial Bold",
        "title_size": 64,
        "title_color": "#ffffff",
        "subtitle_font": "Arial",
        "subtitle_size": 28,
        "subtitle_color": "#cbd5e1",
        "text_font": "Arial",
        "text_size": 22,
        "text_color": "#f1f5f9",
        "accent_color": "#ef4444",
        "animation_duration": 0.8,
        "transition_duration": 0.3,
    },
    "tech": {
        "background_color": "#111827",
        "title_font": "Arial Bold",
        "title_size": 68,
        "title_color": "#ffffff",
        "subtitle_font": "Arial",
        "subtitle_size": 30,
        "subtitle_color": "#9ca3af",
        "text_font": "Arial",
        "text_size": 24,
        "text_color": "#e5e7eb",
        "accent_color": "#10b981",
        "animation_duration": 1.2,
        "transition_duration": 0.4,
    }
}

# Video Layout Settings
LAYOUT_CONFIG = {
    "title_position": (640, 200),  # Center top
    "subtitle_position": (640, 300),  # Below title
    "text_position": (640, 400),  # Main content area
    "logo_position": (1150, 50),  # Top right
    "progress_bar_position": (640, 650),  # Bottom center
    "timestamp_position": (50, 670),  # Bottom left
}

# Animation Presets
ANIMATIONS = {
    "fade_in": {
        "type": "fade",
        "duration": 0.5,
        "ease": "ease_in"
    },
    "slide_up": {
        "type": "slide",
        "direction": "up",
        "duration": 0.8,
        "ease": "ease_out"
    },
    "zoom_in": {
        "type": "zoom",
        "scale_start": 0.8,
        "scale_end": 1.0,
        "duration": 0.6,
        "ease": "ease_in_out"
    },
    "typewriter": {
        "type": "typewriter",
        "speed": 0.05,
        "cursor": True
    }
}

# Color Schemes
COLOR_SCHEMES = {
    "dark_blue": {
        "primary": "#1e40af",
        "secondary": "#3b82f6",
        "background": "#0f172a",
        "text": "#ffffff",
        "accent": "#60a5fa"
    },
    "dark_green": {
        "primary": "#065f46",
        "secondary": "#10b981",
        "background": "#0f172a",
        "text": "#ffffff",
        "accent": "#34d399"
    },
    "dark_red": {
        "primary": "#991b1b",
        "secondary": "#ef4444",
        "background": "#0f172a",
        "text": "#ffffff",
        "accent": "#f87171"
    }
}