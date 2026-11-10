# blackout-video — правила проекта

## Озвучка (обязательно для всех видео канала)

- Голос рассказчика — только из `.env`: `VOICE_ID=QdAaM2uxeXOucroduZw0` («Alikhan - Reels Narrator», собственный голос из Voice Design).
- Модель: `eleven_multilingual_v2`.
- Настройки голоса: `stability 0.35`, `similarity_boost 0.8`, `style 0.45`, `speed 1.1`, `use_speaker_boost true`.
- **Не менять голос, модель или настройки без явного разрешения владельца канала.**
- Ключ `ELEVENLABS_API_KEY` лежит в `.env`; `.env` в `.gitignore` и никогда не коммитится.
- Второстепенные голоса (например, [ДИСПЕТЧЕР]) — встроенные premade-голоса ElevenLabs, не голос рассказчика.
