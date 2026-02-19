# Vercel — визитка

## Сайт в сети

- **Production:** https://test-project-visitka.vercel.app

## Деплой вручную (CLI)

```bash
vercel          # превью
vercel --prod   # в production
```

## Автодеплой при `git push`

Сейчас проект задеплоен через CLI. Чтобы каждый **git push** в репозиторий автоматически обновлял сайт на Vercel:

1. Зайди в **Vercel Dashboard:** https://vercel.com/dashboard  
2. Открой проект **test-project-visitka**  
3. **Settings** → **Git** → **Connect Git Repository**  
4. Нажми **Add GitHub Account** (если ещё не подключён GitHub) и авторизуй Vercel в GitHub  
5. Выбери репозиторий **ilyaantonov2003/Test-project** и подключи его  
6. В настройках Git выбери **Production Branch:** `main` или `master` (в зависимости от твоей основной ветки)

После этого каждый `git push` в выбранную ветку будет запускать деплой на Vercel без запуска `vercel` вручную.

## Редактирование визитки

Главная страница сайта — **index.html** в корне проекта. Меняй текст, ссылки и стили там; после пуша (и при включённом Git — автоматически) изменения появятся на https://test-project-visitka.vercel.app
