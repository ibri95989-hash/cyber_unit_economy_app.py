'use client';

/**
 * Последний рубеж: ошибка в самом корневом layout.
 * Здесь нельзя полагаться ни на провайдеры, ни на глобальные стили.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem',
          background: '#f6f5f1',
          color: '#14171a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Приложение не запустилось</h1>
          <p style={{ marginTop: '0.75rem', fontWeight: 500, color: '#55605b' }}>
            Попробуйте перезагрузить страницу.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '3rem',
              padding: '0 1.5rem',
              borderRadius: '1rem',
              border: 'none',
              background: '#0d7a56',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
            }}
          >
            Перезагрузить
          </button>
        </div>
      </body>
    </html>
  );
}
