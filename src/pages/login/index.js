import { ensureProfileRow, signInWithPassword } from "../../auth-service.js";
import registerValidationConfig from "../../config/register-validation.json";
import { navigateTo } from "../../router/router.js";
import aisleLogo from "../../assets/aisle-logo.svg";

export function renderLoginPage() {
    document.title = "AISLE - Logga in";

    return `
        <section class="auth-shell">
            <div class="auth-stage card">
                <aside class="auth-brand-panel" aria-hidden="true">
                    <span class="auth-logo" role="img" aria-label="AISLE logo" style="--auth-logo-src: url('${aisleLogo}')"></span>
                    <h1 class="auth-title">Handla smartare, snabbare.</h1>
                    <p class="auth-subtitle">Logga in för att få tillgång till dina listor, butikslayouter och personliga flöde.</p>
                    <ul class="auth-feature-list">
                        <li>Sorterade listor efter gångordning</li>
                        <li>Synk mellan enheter</li>
                        <li>Delade listor med familj och vänner</li>
                    </ul>
                </aside>

                <div class="auth-form-panel">
                    <p class="auth-kicker">Välkommen tillbaka</p>
                    <h2 class="auth-form-title">Logga in</h2>
                    <p class="auth-form-description">Använd e-post och lösenord för att fortsätta.</p>

                    <form id="login-form" class="auth-form-surface" novalidate>
                        <div class="form-group">
                            <label for="login-email">E-post</label>
                            <input class="input-field" id="login-email" placeholder="john.doe@example.com" name="email" type="email" autocomplete="email" required />
                        </div>

                        <div class="form-group">
                            <label for="login-password">Lösenord</label>
                            <input class="input-field" id="login-password" placeholder="••••••••" name="password" type="password" autocomplete="current-password" minlength="${Number(registerValidationConfig?.passwordRules?.minLength) || 8}" required />
                        </div>

                        <div class="auth-actions">
                            <button class="btn btn-primary" id="login-submit" type="submit">Logga in</button>
                            <button class="btn btn-secondary" id="to-register" type="button">Skapa konto</button>
                        </div>

                        <p id="login-message" class="auth-message" role="status" aria-live="polite"></p>
                    </form>
                </div>
            </div>
        </section>
    `;
}

export function setupLoginPage() {
    const form = document.querySelector("#login-form");
    const submitButton = document.querySelector("#login-submit");
    const toRegisterButton = document.querySelector("#to-register");
    const message = document.querySelector("#login-message");
    if (!form || !submitButton || !toRegisterButton || !message) return;

    const setMessage = (text, state = "neutral") => {
        message.textContent = text;
        message.dataset.state = state;
    };

    toRegisterButton.addEventListener("click", () => {
        navigateTo("/register");
    });

    form.addEventListener("input", () => {
        setMessage("");
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "");

        submitButton.disabled = true;
        setMessage("Loggar in...", "neutral");

        try {
            await signInWithPassword({ email, password });
            await ensureProfileRow();
            setMessage("Inloggning lyckades. Omdirigerar...", "success");
            navigateTo("/", { replace: true });
        } catch (error) {
            setMessage(error?.message || "Inloggning misslyckades.", "error");
        } finally {
            submitButton.disabled = false;
        }
    });
}
