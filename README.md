# Survey Analyst Bot

An AI-powered survey analysis tool that combines quantitative and qualitative data to generate analytical reports in the style of UNDP/World Bank publications.

## Features

- **Dual Data Integration**: Seamlessly combines quantitative survey results with qualitative analysis
- **Intelligent Querying**: Automatically identifies relevant survey variables from natural language queries
- **Structured Analysis**: Uses a four-step analytical framework (Baseline → Disaggregation → Mechanism → Economic Logic)
- **Professional Output**: Generates diagnostic reports with proper triangulation of quantitative and qualitative evidence

## Prerequisites

- Node.js (v18 or higher)
- API key for the AI model

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/survey-analyst-bot.git
   cd survey-analyst-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser to `http://localhost:3000`

3. Upload your survey data files:
   - **Quantitative Results**: CSV file with survey responses and disaggregation levels
   - **Questionnaire**: CSV file defining survey questions and variable types
   - **Qualitative Analysis**: CSV file with themes, summaries, and quotes from open-ended responses

4. Ask questions about your survey data in natural language, and the bot will:
   - Identify relevant variables
   - Query both quantitative and qualitative data
   - Synthesize findings using the analytical framework
   - Generate professional analytical paragraphs

## Project Structure

```
survey-analyst-bot/
├── components/          # React components
│   ├── ChatMessage.tsx
│   └── FileUploader.tsx
├── services/            # Core services
│   └── geminiService.ts # AI agent and data querying logic
├── utils/              # Utility functions
│   ├── csv.ts          # CSV parsing
│   └── excel.ts        # Excel parsing
├── types.ts            # TypeScript type definitions
└── App.tsx             # Main application component
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## License

[Add your license here]
