# API Keys Configuration

Скрипты генерации изображений (`generate-image.sh`, `generate-image-pollinations.sh`) используют конфигурационные файлы с API-ключами. Эти файлы добавлены в `.gitignore` и не попадают в репозиторий.

## `.gemini.json` — Google Gemini API

Используется в `generate-image.sh`.

```json
{
  "apiKey": "YOUR_GEMINI_API_KEY",
  "projectName": "projects/YOUR_PROJECT_ID",
  "model": "gemini-2.5-flash-image"
}
```

| Поле          | Описание                                                                 |
|---------------|--------------------------------------------------------------------------|
| `apiKey`      | API-ключ Google AI Studio. Получить: https://aistudio.google.com/apikey  |
| `projectName` | ID проекта в формате `projects/XXXXXXXXX`                                |
| `model`       | Модель для генерации изображений                                         |

## `.pollinations.json` — Pollinations API

Используется в `generate-image-pollinations.sh`.

```json
{
  "apiKey": "YOUR_POLLINATIONS_API_KEY",
  "model": "gptimage",
  "width": 512,
  "height": 512
}
```

| Поле     | Описание                                                        |
|----------|-----------------------------------------------------------------|
| `apiKey` | API-ключ Pollinations. Получить: https://pollinations.ai        |
| `model`  | Модель для генерации (`gptimage`)                               |
| `width`  | Ширина изображения в пикселях                                   |
| `height` | Высота изображения в пикселях                                   |
