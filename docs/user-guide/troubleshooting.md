# Troubleshooting and diagnostics

## When something goes wrong

- An error message usually ends with **what to try**, for example "Check device orientation, bias and source values" for a circuit that does not converge.
- A lab tab that cannot show a result displays an error panel. Its **Reset** button restores that tab's example inputs.
- If the circuit solver warns that a node voltage "is not physical", a current source is probably driving an open or reverse-biased path.

## Diagnostics centre

Open it from **Help → Diagnostics and feedback**, or from the command palette (**Ctrl K**). It shows:

- **Health:** the version, whether the project is saved, whether the offline cache is active, online or offline status, and whether desktop features and external tools are available;
- **Recent errors:** the errors from this session, with recovery hints;
- **Diagnostic report:** a preview of the report you can copy or download.

The report never contains API keys, passwords, file paths, e-mail addresses or project content.
It records counts (for example "12 components") instead of the circuit itself. Read the preview
before you share it. Nothing is sent automatically.

## Reporting a problem

**Report a problem** opens the project's GitHub issue forms. Attach the diagnostic report if it
helps. Do not attach projects, captures or credentials that you do not want to be public.
Security problems go through private reporting; see `SECURITY.md`.

## Common problems

| Problem | What to do |
|---|---|
| "Project storage: error" (storage full) | Export the project, then free browser storage or use another browser. |
| The app does not start offline | Open it once while online, so the offline cache is filled. The diagnostics centre shows "Offline cache: controlling" when it is ready. |
| Hardware or native tools are unavailable | The browser version cannot reach devices. Use the desktop app and grant the permission for your project. |
| An old project will not open | Projects from newer versions need a newer app. Files from older versions are migrated automatically; if that fails, the original file is left unchanged. |
