# Session State — 2026-09-17

## Avances de hoy

- Migración de `/mensajes` a `ThreeColumnLayout`.
- Adición de la sección `## Sistema de Diseno: Estilo Bento Grid UI` en `CLAUDE.md`.
- Auditoria de alineacion del eje vertical entre vistas principales.

## Estado tecnico actual

Se estaba ejecutando script de verificacion visual con Playwright, pero
servidor dev se cayo (exit code 1). Script temporal debe limpiarse o
reintentarse en siguiente sesion.

## Pendientes prioritarios para la siguiente sesion

1. **Refactor de `/publicar`** (`create-order-section.tsx`): remover
   `mx-auto`, solucionar campos apretados/hardcodeados, montarlo en tarjeta
   Bento UI dentro de las 7 columnas alineada con `/tutores`.
2. **Ajuste de `/inicio`** (`home.tsx`): limitar ancho a 60%-65% (alineado
   a la izquierda con Tutores), reemplazar scrollbar nativo por
   `<ScrollArea>` elegante.
3. **Migracion de `/pedidos`** al grid de 12 columnas.
