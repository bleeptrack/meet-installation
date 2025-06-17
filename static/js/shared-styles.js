export const sharedStyles = `
    * {
        font-family: 'Lavishly Yours', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 1.5rem;
    }
    button, .button, .download-link {
        padding: 20px 40px;
        background-color: white;
        color: black;
        border: 3px solid rgba(255, 255, 255, 0.6);
        border-radius: 30px;
        cursor: pointer;
        font-family: 'Chewy', 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif;
        font-size: 28px;
        box-shadow: 
            0 0 20px rgba(255, 255, 255, 0.8),
            0 0 40px rgba(255, 255, 255, 0.4),
            0 0 60px rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
        line-height: 1.2;
        font-weight: bold;
    }

    button:hover, .button:hover, .download-link:hover {
        background-color: #f8f8f8;
        box-shadow: 
            0 0 30px rgba(255, 255, 255, 0.9),
            0 0 50px rgba(255, 255, 255, 0.5),
            0 0 70px rgba(255, 255, 255, 0.3);
        transform: translateY(-2px);
    }

    button:active, .button:active, .download-link:active {
        transform: scale(0.98);
        box-shadow: 
            0 0 15px rgba(255, 255, 255, 0.6),
            0 0 30px rgba(255, 255, 255, 0.3),
            0 0 45px rgba(255, 255, 255, 0.1);
    }

    button:disabled, .button:disabled, .download-link:disabled {
        background-color: #f0f0f0;
        color: #888;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
        border-color: rgba(255, 255, 255, 0.3);
    }

    @media (max-width: 768px) {
        button, .button, .download-link {
            font-size: 24px;
            padding: 16px 32px;
        }
    }
`; 