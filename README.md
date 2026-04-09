# Filify Chrome Extension

Filify helps you save job-application details once and auto-fill forms across Google Forms and other websites.

## Features

- One-click form autofill from popup.
- Automatic field detection using labels, placeholders, IDs, and nearby question text.
- Supports common fields for students and job applicants:
  - Name, email, phone
  - College, SRN, degree, course, specialization
  - 10th/12th percentage, CGPA, graduation year
  - LinkedIn, GitHub, portfolio, resume link, skills, location, and more
- Custom parameters for unlimited additional fields (notice period, PAN, DOB, etc.).
- AI cover letter generation tailored to role/company/job description.
- Autofill history tracking.
- Import/Export backup of your profile JSON.
- Keyboard shortcut: `Alt+Shift+F` to fill current form.

## Project Structure

- `manifest.json` - extension manifest (MV3)
- `background/background.js` - service worker, AI generation, history
- `content/content.js` - field detection and autofill engine
- `popup/*` - quick actions and cover letter UI
- `options/*` - full profile, custom fields, AI settings

## How To Load In Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `d:/My Projects/filify`.
5. Pin Filify from extension toolbar.

## First-Time Setup

1. Open Filify popup.
2. Click **Open Full Profile Settings**.
3. Fill your profile data and save.
4. Add custom parameters for fields specific to your use case.
5. (Optional) Add AI API endpoint, model, and API key for cover letter generation.

## AI Cover Letter Setup

In settings:

- `API Endpoint`: OpenAI-compatible chat completions endpoint
  - Example: `https://api.openai.com/v1/chat/completions`
- `Model`: Example `gpt-4o-mini`
- `API Key`: your key from provider

Then from popup:

1. Enter role, company, and job description.
2. Click **Generate Cover Letter**.

## Notes

- Some websites with highly custom controls may block autofill for certain fields.
- Use custom aliases to improve matching accuracy.
- API keys are stored in Chrome local extension storage on your machine.

## Next Improvements (optional)

- Resume auto-upload assistance for known platforms.
- Per-site field mapping memory.
- Smart answer templates for common screening questions.
- AI-generated answers for "Why should we hire you?" style prompts.
