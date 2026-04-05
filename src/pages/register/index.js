import { ensureProfileRow, signUp } from "../../auth-service.js";
import { navigateTo } from "../../router/router.js";
import registerValidationConfig from "../../config/register-validation.json";

// Detta är bara en placeholder. Ska göra om hela sidan. Så i dagsläget är det bara en snabb och enkel design som suger xd.
const minNameLetters = Number(registerValidationConfig?.nameRules?.minLetters) || 2;
const minPasswordLength = Number(registerValidationConfig?.passwordRules?.minLength) || 8;
const requirePasswordLetter = registerValidationConfig?.passwordRules?.requireLetter !== false;
const requirePasswordNumber = registerValidationConfig?.passwordRules?.requireNumber !== false;
const blockedNameWords = Array.isArray(registerValidationConfig?.nameRules?.blockedWords) ? registerValidationConfig.nameRules.blockedWords.map((word) => String(word).toLowerCase()) : [];
const validationMessages = {
    requiredField: registerValidationConfig?.requiredFieldMessage || "Alla fält måste fyllas i.",
    firstNameTooShort: registerValidationConfig?.messages?.firstNameTooShort || "Förnamn måste vara minst {min} bokstäver.",
    lastNameTooShort: registerValidationConfig?.messages?.lastNameTooShort || "Efternamn måste vara minst {min} bokstäver.",
    blockedName: registerValidationConfig?.messages?.blockedName || "Namnet innehåller ord som inte är tillåtna.",
    passwordTooShort: registerValidationConfig?.messages?.passwordTooShort || "Lösenord måste vara minst {min} tecken.",
    passwordMissingLetter: registerValidationConfig?.messages?.passwordMissingLetter || "Lösenord måste innehålla minst en bokstav.",
    passwordMissingNumber: registerValidationConfig?.messages?.passwordMissingNumber || "Lösenord måste innehålla minst en siffra.",
};

function countLetters(value) {
    const matches = String(value).match(/\p{L}/gu);
    return matches ? matches.length : 0;
}

function hasBlockedWord(value) {
    const normalized = String(value).toLowerCase();
    return blockedNameWords.some((word) => normalized.includes(word));
}

function hasAnyLetter(value) {
    return /\p{L}/u.test(String(value));
}

function hasAnyNumber(value) {
    return /\d/.test(String(value));
}

export function renderRegisterPage() {
    document.title = "AISLE - Skapa konto";

    return `
        <section class="auth-shell">
            <div class="auth-stage card">
                <aside class="auth-brand-panel" aria-hidden="true">
                    <p class="auth-kicker">AISLE</p>
                    <h1 class="auth-title">Skapa ditt konto.</h1>
                    <p class="auth-subtitle">Bygg smarta inköpslistor, hitta rätt ordning i butiken och synka allt mellan dina enheter.</p>
                    <ul class="auth-feature-list">
                        <li>Personligt konto med dina layouter</li>
                        <li>Trygg inloggning via Supabase Auth</li>
                        <li>Redo för delning och samarbete</li>
                    </ul>
                </aside>

                <div class="auth-form-panel">
                    <button class="auth-back-link" id="to-login" type="button" aria-label="Tillbaka till inloggning">
                        <i class="ti ti-arrow-left auth-back-icon" aria-hidden="true"></i>
                        <span class="auth-back-text">Till inloggning</span>
                    </button>

                    <p class="auth-kicker">Nytt konto</p>
                    <h2 class="auth-form-title">Skapa konto</h2>
                    <p class="auth-form-description">Fyll i dina uppgifter för att komma igång.</p>

                    <form id="register-form" class="auth-form-surface" novalidate>
                        <div class="form-group">
                            <label for="register-first-name">Förnamn</label>
                            <input class="input-field" id="register-first-name" placeholder="John" name="firstName" type="text" autocomplete="given-name" required />
                        </div>

                        <div class="form-group">
                            <label for="register-last-name">Efternamn</label>
                            <input class="input-field" id="register-last-name" placeholder="Doe" name="lastName" type="text" autocomplete="family-name" required />
                        </div>

                        <div class="form-group">
                            <label for="register-email">E-post</label>
                            <input class="input-field" id="register-email" placeholder="john.doe@example.com" name="email" type="email" autocomplete="email" required />
                        </div>

                        <div class="form-group">
                            <label for="register-password">Lösenord</label>
                            <input class="input-field" id="register-password" placeholder="••••••••" name="password" type="password" autocomplete="new-password" minlength="${minPasswordLength}" required />
                        </div>

                        <div class="auth-actions">
                            <button class="btn btn-primary" id="register-submit" type="submit">Skapa konto</button>
                        </div>

                        <p id="register-message" class="auth-message" role="status" aria-live="polite"></p>
                    </form>
                </div>
            </div>
        </section>
    `;
}

export function setupRegisterPage() {
    const form = document.querySelector("#register-form");
    const submitButton = document.querySelector("#register-submit");
    const toLoginButton = document.querySelector("#to-login");
    const message = document.querySelector("#register-message");

    if (!form || !submitButton || !toLoginButton || !message) return;

    const setMessage = (text, state = "neutral") => {
        message.textContent = text;
        message.dataset.state = state;
    };

    toLoginButton.addEventListener("click", () => {
        navigateTo("/login");
    });

    form.addEventListener("input", () => {
        setMessage("");
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const firstName = String(formData.get("firstName") || "").trim();
        const lastName = String(formData.get("lastName") || "").trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "");

        if (!firstName || !lastName || !email || !password) {
            setMessage(validationMessages.requiredField, "error");
            return;
        }

        if (countLetters(firstName) < minNameLetters) {
            setMessage(validationMessages.firstNameTooShort.replace("{min}", String(minNameLetters)), "error");
            return;
        }

        if (countLetters(lastName) < minNameLetters) {
            setMessage(validationMessages.lastNameTooShort.replace("{min}", String(minNameLetters)), "error");
            return;
        }

        if (hasBlockedWord(firstName) || hasBlockedWord(lastName)) {
            setMessage(validationMessages.blockedName, "error");
            return;
        }

        if (String(password).length < minPasswordLength) {
            setMessage(validationMessages.passwordTooShort.replace("{min}", String(minPasswordLength)), "error");
            return;
        }

        if (requirePasswordLetter && !hasAnyLetter(password)) {
            setMessage(validationMessages.passwordMissingLetter, "error");
            return;
        }

        if (requirePasswordNumber && !hasAnyNumber(password)) {
            setMessage(validationMessages.passwordMissingNumber, "error");
            return;
        }

        submitButton.disabled = true;
        setMessage("Skapar konto...", "neutral");

        try {
            const data = await signUp({
                email,
                password,
                options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    name: fullName,
                },
                },
            });
            const hasSession = Boolean(data?.session);

            if (hasSession) {
                await ensureProfileRow();
                setMessage("Konto skapat. Omdirigerar...", "success");
                navigateTo("/", { replace: true });
                return;
            }

            setMessage("Konto skapat. Kontrollera din e-post och logga in.", "success");
            navigateTo("/login", { replace: true });
        } catch (error) {
            setMessage(error?.message || "Registrering misslyckades.", "error");
        } finally {
            submitButton.disabled = false;
        }
    });
}
