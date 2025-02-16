# Glotto AI Translator

Glotto is a powerful tool designed to translate i18n JSON files using advanced AI technology. It streamlines the localization process by automatically
translating your language files to any target language while maintaining the JSON structure.

## Features

- Translate JSON files while preserving the original structure
- Support for multiple language pairs
- Configurable batch processing with customizable key limits
- Command-line interface for easy integration into your workflow

## Installation

```bash
# Installation command (Add your package manager's installation command here)
```

## Usage

You can use Glotto AI Translator in two ways:

### Basic Usage

```bash
glotto --key <your-api-key> -i en.json -o ar.json -f English -t Arabic -k 4
```

### Extended Usage

```bash
glotto --key <your-api-key> --input=en.json --output=tr.json --from=English --to=Turkish --maxkeys=10
```

### Parameters

- `--key`: Your API key for the translation service
- `--input` or `-i`: Source JSON file
- `--output` or `-o`: Target JSON file
- `--from` or `-f`: Source language
- `--to` or `-t`: Target language
- `--maxkeys` or `-k`: Maximum number of keys to process in each batch

## Development

To run the project in development mode:

```bash
deno task cli --key <your-api-key> --input=en.json --output=tr.json --from=English --to=Turkish --maxkeys=10
```

### Building the Project

To create a production build:

```bash
deno task build
```

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## License

MIT Licence @ 2025
