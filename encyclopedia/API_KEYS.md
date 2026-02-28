# API Keys Configuration

Скрипт генерации изображений (`scripts/generate-image.sh`) использует конфигурационный файл с API-ключом. Этот файл добавлен в `.gitignore` и не попадает в репозиторий.

## `scripts/.pollinations.json` — Pollinations API

Используется в `scripts/generate-image.sh`.

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
