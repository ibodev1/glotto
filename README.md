# Glotto AI Translator

Glotto is a powerful tool designed to translate i18n JSON files using advanced AI technology. It streamlines the localization process by automatically
translating your language files to any target language while maintaining the JSON structure.

## Features

- Translate JSON files while preserving the original structure
- Support for multiple language pairs
- Configurable batch processing with customizable key limits
- Command-line interface for easy integration into your workflow

## Installation

Glotto can be installed and used through either JSR (Deno) or npm. Choose the method that best suits your development environment.

### [JSR (Deno)](https://jsr.io/@ibodev/glotto)

#### Global Installation

Install Glotto globally to use it as a CLI tool from anywhere:

```bash
deno install --global --name glotto -A jsr:@ibodev/glotto
```

#### Direct Execution

Alternatively, run Glotto directly without installation:

```bash
deno run -A jsr:@ibodev/glotto
```

### [npm (Node)](https://www.npmjs.com/package/glotto)

#### Global Installation

Install Glotto globally via npm to use it as a CLI tool:

```bash
npm install --global glotto
```

After installation, the `glotto` command will be available in your terminal.

#### Direct Execution

Run Glotto directly using npx without installation:

```bash
npx glotto
```

## Usage

### Basic usage (default Gemini)

```bash
glotto --key <gemini-api-key> -i en.json -o ar.json -f English -t Arabic
```

### Use OpenAI instead of Gemini

```bash
glotto --key <openai-api-key> --input=en.json --output=tr.json --from=English --to=Turkish -m openai
```

Optional custom OpenAI base URL:

```bash
glotto --key <openai-api-key> --input=en.json --output=tr.json --from=English --to=Turkish -m openai --url=https://api.openai.com/v1
```

### Use Anthropic (Claude)

```bash
glotto --key <anthropic-api-key> --input=en.json --output=tr.json --from=English --to=Turkish -m anthropic
```

Optional custom Anthropic base URL:

```bash
glotto --key <anthropic-api-key> --input=en.json --output=tr.json --from=English --to=Turkish -m anthropic --url=https://api.anthropic.com
```

### Parameters

- `--key`: API key for the selected AI provider
- `--input` or `-i`: Source JSON file
- `--output` or `-o`: Target JSON file
- `--from` or `-f`: Source language
- `--to` or `-t`: Target language
- `--module` or `-m`: AI module (`gemini` | `openai` | `anthropic`, default: `gemini`)
- `--url`: Custom base URL for OpenAI/Anthropic (optional)

## Development

To run the project in development mode:

```bash
deno task cli --key <gemini-or-openai-api-key> --input=en.json --output=tr.json --from=English --to=Turkish -m gemini
```

### Building the Project

To create a production build:

```bash
deno task build
```

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## License

MIT Licence @ 2026
