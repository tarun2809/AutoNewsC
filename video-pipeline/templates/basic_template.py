"""
Basic video template for news content
"""
from moviepy.editor import *
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from .config import TEMPLATE_CONFIG, LAYOUT_CONFIG, ANIMATIONS

def create_title_clip(text, duration=3, template="news"):
    """Create an animated title clip"""
    config = TEMPLATE_CONFIG[template]
    
    # Create background
    bg_clip = ColorClip(
        size=(1280, 720),
        color=config["background_color"],
        duration=duration
    )
    
    # Create title text
    title_clip = TextClip(
        text,
        fontsize=config["title_size"],
        font=config["title_font"],
        color=config["title_color"],
        size=(1200, None),
        method='caption'
    ).set_position('center').set_duration(duration)
    
    # Add fade in animation
    title_clip = title_clip.crossfadein(0.5)
    
    return CompositeVideoClip([bg_clip, title_clip])

def create_content_clip(text, duration=5, template="news"):
    """Create a content slide with text"""
    config = TEMPLATE_CONFIG[template]
    
    # Create background
    bg_clip = ColorClip(
        size=(1280, 720),
        color=config["background_color"],
        duration=duration
    )
    
    # Create main text
    text_clip = TextClip(
        text,
        fontsize=config["text_size"],
        font=config["text_font"],
        color=config["text_color"],
        size=(1000, None),
        method='caption'
    ).set_position('center').set_duration(duration)
    
    # Add animations
    text_clip = text_clip.crossfadein(0.3).crossfadeout(0.3)
    
    return CompositeVideoClip([bg_clip, text_clip])

def create_transition_clip(duration=1, template="news"):
    """Create a transition between clips"""
    config = TEMPLATE_CONFIG[template]
    
    # Create animated background
    bg_clip = ColorClip(
        size=(1280, 720),
        color=config["accent_color"],
        duration=duration
    ).crossfadein(duration/2).crossfadeout(duration/2)
    
    return bg_clip

def create_end_screen(duration=3, template="news"):
    """Create an end screen with branding"""
    config = TEMPLATE_CONFIG[template]
    
    # Create background
    bg_clip = ColorClip(
        size=(1280, 720),
        color=config["background_color"],
        duration=duration
    )
    
    # Add "Subscribe" text
    subscribe_text = TextClip(
        "Subscribe for more AI-generated news",
        fontsize=32,
        font=config["text_font"],
        color=config["text_color"],
        size=(800, None),
        method='caption'
    ).set_position('center').set_duration(duration)
    
    # Add logo/branding
    brand_text = TextClip(
        "AutoNews",
        fontsize=48,
        font=config["title_font"],
        color=config["accent_color"]
    ).set_position(('center', 200)).set_duration(duration)
    
    # Combine elements
    end_clip = CompositeVideoClip([
        bg_clip,
        brand_text.crossfadein(0.5),
        subscribe_text.crossfadein(1.0)
    ])
    
    return end_clip

def apply_ken_burns_effect(image_path, duration=3, zoom_ratio=1.2):
    """Apply Ken Burns effect to static images"""
    try:
        # Load and resize image
        img_clip = ImageClip(image_path, duration=duration)
        
        # Get dimensions
        w, h = img_clip.size
        
        # Calculate zoom
        zoom_w = int(w * zoom_ratio)
        zoom_h = int(h * zoom_ratio)
        
        # Create zoom effect
        def zoom_in(get_frame, t):
            frame = get_frame(t)
            zoom_factor = 1 + (zoom_ratio - 1) * (t / duration)
            
            # Resize frame
            new_w = int(w * zoom_factor)
            new_h = int(h * zoom_factor)
            
            # Calculate crop position (center)
            crop_x = (new_w - w) // 2
            crop_y = (new_h - h) // 2
            
            return frame
        
        return img_clip.fl(zoom_in)
        
    except Exception:
        # Fallback to static image
        return ImageClip(image_path, duration=duration)

def create_subtitle_clip(text, duration, y_position=600):
    """Create subtitle overlay"""
    subtitle = TextClip(
        text,
        fontsize=24,
        font='Arial-Bold',
        color='white',
        stroke_color='black',
        stroke_width=1,
        size=(1200, None),
        method='caption'
    ).set_position(('center', y_position)).set_duration(duration)
    
    return subtitle.crossfadein(0.2).crossfadeout(0.2)

def create_progress_bar(current_time, total_time, width=300, height=4):
    """Create a progress bar overlay"""
    progress = current_time / total_time
    
    # Create progress bar background
    bg_bar = ColorClip(
        size=(width, height),
        color='#333333'
    ).set_position(('center', 680))
    
    # Create progress fill
    fill_width = int(width * progress)
    if fill_width > 0:
        fill_bar = ColorClip(
            size=(fill_width, height),
            color='#3b82f6'
        ).set_position((640 - width//2, 680))
        
        return CompositeVideoClip([bg_bar, fill_bar])
    
    return bg_bar