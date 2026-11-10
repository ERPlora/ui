# @erplora/ui

Componentes Vue (Ionic), el SDK de la API y el armazón de las apps que comparten el Hub (`ERPlora/hub`) y el SaaS
(`ERPlora/saas`) de ERPlora. Cada uno lo lleva como submódulo en `packages/ui`.

## Trabajar con el repo

Suelto, con sus propias pruebas (pide Node y pnpm; la versión de pnpm sale de `packageManager` en `package.json`):

```bash
git clone https://github.com/ERPlora/ui.git && cd ui
git config core.hooksPath .githooks
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test
```

Como submódulo de hub o saas manda el `pnpm-workspace.yaml` de la app y el de aquí se ignora: se instala desde la raíz
de la app (`pnpm install`) y las pruebas se corren con `pnpm --filter @erplora/ui test`. Un cambio de ui se hace en un
worktree del submódulo, con su commit y su push, y después se actualiza el puntero en hub y en saas.

## Comprobaciones antes del push (sin CI)

El repositorio no usa GitHub Actions (Ioan, 2026-11-10: en la organización solo `ERPlora/aws` las usa). Lo que corría
el workflow `test` en cada push a `main` y en cada PR lo corre el hook versionado `.githooks/pre-push` en la máquina
que empuja, y un rojo para el push con el paso que falló. No hay variable para saltárselo.

Se activa una vez por clon, en el Mac y en el Linux:

```bash
# Clon suelto
git config core.hooksPath .githooks

# Submódulo, desde la raíz de hub o de saas: solo cuando su puntero de packages/ui ya incluye .githooks/
test -x packages/ui/.githooks/pre-push && git -C packages/ui config core.hooksPath .githooks
```

- **Qué comprueba**, sobre una copia limpia del commit que se empuja (un worktree temporal fuera de hub y de saas,
  nunca el árbol de trabajo, para que mande el `pnpm-workspace.yaml` de ui, como en la CI) y en el orden del workflow:
  `actionlint -color` si el commit tiene workflows en `.github/workflows/` (sin ninguno no hay nada que revisar),
  `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` y `pnpm test`. Pide pnpm, y actionlint solo si vuelve
  un workflow. Usa el Node de la máquina; la CI usaba Node 24.
- **Cuánto tarda**: unos 45 s en el Mac con la store de pnpm ya llena (instalación 5 s, lint 10 s, typecheck 9 s y
  Vitest 20 s).
- **Cuándo**: en todo push de una rama, `main` o la de una PR, como el workflow, que no filtraba rutas. Un tag no
  comprueba nada (el workflow tampoco corría con tags) y borrar una rama tampoco.
- **Primero los hooks globales**: un `core.hooksPath` del repo sustituye al global, así que cada hook de `.githooks/`
  (`pre-push`, `pre-commit`, `commit-msg` y `applypatch-msg`) ejecuta antes el del mismo nombre de
  `git config --global core.hooksPath`, si existe, con los mismos argumentos y la misma entrada; si falla, para. Sin
  hooks globales (un clon nuevo, el Linux) no hacen nada más.
- **En el submódulo**: su configuración vive en `.git/modules/packages/ui/config` de hub o de saas y la comparten
  todos sus worktrees. Si el submódulo vuelve a un commit sin `.githooks/` (un puntero anterior), `core.hooksPath`
  apunta a una carpeta que no existe y no corre ningún hook, tampoco los globales: por eso se activa solo con la
  comprobación de arriba, y se deshace con `git -C packages/ui config --unset core.hooksPath`.
- **Lo que se pierde**: ya no hay una comprobación en GitHub. Un clon sin `core.hooksPath` empuja sin comprobar y la
  PR de un fork no se comprueba sola: quien la revisa trae la rama y corre las comprobaciones antes de mergear.
- Batería de los hooks: `bash .githooks/pre-push.test.sh` (bash 5; en el Mac, el de Homebrew: el 3.2 da verdes
  falsos y la batería se niega a correr con él).
