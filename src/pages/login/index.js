import { ensureProfileRow, signInWithPassword } from "../../auth-service.js";
import registerValidationConfig from "../../config/register-validation.json";
import { navigateTo } from "../../router/router.js";

// Kommer göra om denna sida också. Den funkar för tillfället. Men detta är bara en snabb placeholder utan att göra någon speciell design eller så.
export function renderLoginPage() {
    return `
        <section class="page-container">
            <div class="card" style="max-width: 520px; margin: 40px auto;">
                <h1>Logga in</h1>
                <p>Logga in för att komma åt appen.</p>

                <form id="login-form" class="form-surface" style="max-width: 100%;">
                    <div class="form-group">
                        <label for="login-email">E-post</label>
                        <input class="input-field" id="login-email" name="email" type="email" autocomplete="email" required />
                    </div>

                    <div class="form-group">
                        <label for="login-password">Lösenord</label>
                        <input class="input-field" id="login-password" name="password" type="password" autocomplete="current-password" minlength="${Number(registerValidationConfig?.passwordRules?.minLength) || 8}" required />
                    </div>

                    <div class="button-group">
                        <button class="btn btn-primary" id="login-submit" type="submit">Logga in</button>
                        <button class="btn btn-secondary" id="to-register" type="button">Skapa konto</button>
                    </div>

                    <p id="login-message" style="margin-top: 12px;"></p>
                </form>
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

    toRegisterButton.addEventListener("click", () => {
        navigateTo("/register");
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "");

        submitButton.disabled = true;
        message.textContent = "Loggar in...";

        try {
            await signInWithPassword({ email, password });
            await ensureProfileRow();
            message.textContent = "Inloggning lyckades. Omdirigerar...";
            navigateTo("/", { replace: true });
        } catch (error) {
            message.textContent = error?.message || "Inloggning misslyckades.";
        } finally {
            submitButton.disabled = false;
        }
    });
}
