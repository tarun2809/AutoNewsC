import gradio as gr
import uvicorn
from main import app, summarize_text
from threading import Thread
import time

# Start FastAPI server in background
def start_fastapi():
    uvicorn.run(app, host="0.0.0.0", port=7000)

# Start FastAPI in a separate thread
fastapi_thread = Thread(target=start_fastapi, daemon=True)
fastapi_thread.start()

# Give FastAPI time to start
time.sleep(2)

def summarize_interface(text, max_length=150, min_length=50, model_name="facebook/bart-large-cnn"):
    """Gradio interface for summarization"""
    try:
        result = summarize_text(text, max_length, min_length, model_name)
        return result["summary"], f"Quality Score: {result['quality_score']:.3f}"
    except Exception as e:
        return f"Error: {str(e)}", ""

# Create Gradio interface
with gr.Blocks(title="AutoNews Summarizer", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 📰 AutoNews Summarizer
    
    AI-powered news article summarization using state-of-the-art transformer models.
    Supports both BART and T5 models with quality scoring.
    """)
    
    with gr.Row():
        with gr.Column():
            text_input = gr.Textbox(
                label="News Article Text",
                placeholder="Paste your news article here...",
                lines=10,
                max_lines=20
            )
            
            with gr.Row():
                model_dropdown = gr.Dropdown(
                    choices=["facebook/bart-large-cnn", "t5-base"],
                    value="facebook/bart-large-cnn",
                    label="Model"
                )
                max_length_slider = gr.Slider(
                    minimum=50,
                    maximum=300,
                    value=150,
                    step=10,
                    label="Max Summary Length"
                )
                min_length_slider = gr.Slider(
                    minimum=20,
                    maximum=100,
                    value=50,
                    step=5,
                    label="Min Summary Length"
                )
            
            summarize_btn = gr.Button("Summarize", variant="primary")
        
        with gr.Column():
            summary_output = gr.Textbox(
                label="Summary",
                lines=8,
                max_lines=15,
                interactive=False
            )
            quality_output = gr.Textbox(
                label="Quality Metrics",
                lines=2,
                interactive=False
            )
    
    # Example articles
    gr.Markdown("## Example Articles")
    
    examples = [
        [
            """Breaking: Scientists at MIT have developed a new artificial intelligence system that can predict climate change patterns with unprecedented accuracy. The system, called ClimateAI, uses deep learning algorithms to analyze vast amounts of environmental data from satellites, weather stations, and ocean sensors. Initial tests show the system can forecast temperature and precipitation patterns up to six months in advance with 95% accuracy. The research team, led by Dr. Sarah Chen, believes this breakthrough could revolutionize how we prepare for and respond to climate-related disasters. The system has already been tested in collaboration with the National Weather Service and has shown promising results in predicting extreme weather events. Climate scientists worldwide are calling this development a game-changer for climate science and disaster preparedness.""",
            150,
            50,
            "facebook/bart-large-cnn"
        ],
        [
            """Technology giant announces major breakthrough in quantum computing. The company's new quantum processor, featuring 1,000 qubits, represents a significant leap forward in quantum technology. The processor can perform complex calculations that would take traditional computers thousands of years to complete. This advancement could revolutionize fields such as drug discovery, financial modeling, and cryptography. The quantum processor uses a novel error correction system that maintains quantum coherence for extended periods. Industry experts believe this breakthrough brings practical quantum computing applications much closer to reality.""",
            120,
            40,
            "t5-base"
        ]
    ]
    
    gr.Examples(
        examples=examples,
        inputs=[text_input, max_length_slider, min_length_slider, model_dropdown],
        outputs=[summary_output, quality_output],
        fn=summarize_interface,
        cache_examples=True
    )
    
    # Event handlers
    summarize_btn.click(
        fn=summarize_interface,
        inputs=[text_input, max_length_slider, min_length_slider, model_dropdown],
        outputs=[summary_output, quality_output]
    )
    
    gr.Markdown("""
    ### About
    This summarizer uses transformer models fine-tuned for news summarization:
    - **BART**: Best for general news articles and longer content
    - **T5**: Excellent for technical articles and structured content
    
    Quality scores are calculated using ROUGE metrics comparing the summary to reference patterns.
    
    For API access, the FastAPI service runs on port 7000 with endpoints:
    - `POST /summarize` - Summarize text
    - `GET /health` - Health check
    - `GET /models` - Available models
    """)

if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False
    )