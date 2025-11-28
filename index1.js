import React, { useState, useRef, useEffect } from 'react';
import { Send, Car, Loader2 } from 'lucide-react';

export default function Carspire() {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hi! I'm Carspire, your automotive AI assistant powered by Gemini. Ask me anything about cars - maintenance, buying advice, technical questions, car history, or recommendations! I'm ready to dive into the details!"
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            // 🚨 CRITICAL STEP: YOU MUST GET AND PASTE YOUR KEY HERE 🚨
            const API_KEY = 'AIzaSyBMbi4aCzCB5pMF5Uzyqmu9RLf6mA2GI1I';
            // Get your key here: https://makersuite.google.com/app/apikey
            // ----------------------------------------------------------------

            if (API_KEY === 'AIzaSyBMbi4aCzCB5pMF5Uzyqmu9RLf6mA2GI1I' || API_KEY.length < 30) {
                throw new Error('API Key not configured');
            }

            // This uses the exact endpoint you specified: gemini-2.5-flash
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;


            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            // This is the AI's persona and instructions
                            text: `You are Carspire, an **expert automotive AI assistant** specializing in *all things car-related*. 
You have deep, comprehensive knowledge about cars, including detailed specifications, complex technical explanations, buying advice, maintenance schedules, car history, motorsport, and future vehicle technology.
Your goal is to provide **helpful, accurate, detailed, and enthusiastic responses** that are conversational and friendly. **Crucially, you must always keep your response strictly focused on cars or automotive topics.**

User question: ${userMessage}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            });

            const data = await response.json();

            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                const assistantMessage = data.candidates[0].content.parts[0].text;
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: assistantMessage
                }]);
            } else {
                const errorDetail = data.error?.message || 'The model did not return a valid response.';
                throw new Error(errorDetail);
            }
        } catch (error) {
            console.error("Gemini API Error:", error);
            let errorMessage = "Sorry, I'm having trouble connecting right now. Please ensure your Gemini API key is correct and valid. Get a free key at https://makersuite.google.com/app/apikey";

            if (error.message.includes('API Key not configured')) {
                errorMessage = "🛑 **ERROR:** Please replace 'YOUR_GEMINI_API_KEY_HERE' in the code with your actual Gemini API key to start talking to me!";
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white p-4 shadow-lg">
                <div className="flex items-center gap-3 max-w-4xl mx-auto">
                    <Car className="w-8 h-8" />
                    <div>
                        <h1 className="text-2xl font-bold">Carspire</h1>
                        <p className="text-sm text-blue-100">Your AI Automotive Assistant</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl w-full mx-auto">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-100'
                                }`}
                        >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-700 text-slate-100 rounded-2xl px-4 py-3">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-700 bg-slate-800 p-4">
                <div className="max-w-4xl mx-auto flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask me about cars..."
                        className="flex-1 bg-slate-700 text-white rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-full p-3 transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}