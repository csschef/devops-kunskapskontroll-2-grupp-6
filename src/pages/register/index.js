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
    return `
        <section class="page-container">
            <div class="card" style="max-width: 520px; margin: 40px auto;">
                <h1>Skapa konto</h1>
                <p>Registrera dig för att låsa upp appen.</p>

                <form id="register-form" class="form-surface" style="max-width: 100%;">
                    <div class="form-group">
                        <label for="register-first-name">Förnamn</label>
                        <input class="input-field" id="register-first-name" name="firstName" type="text" autocomplete="given-name" required />
                    </div>

                    <div class="form-group">
                        <label for="register-last-name">Efternamn</label>
                        <input class="input-field" id="register-last-name" name="lastName" type="text" autocomplete="family-name" required />
                    </div>

                    <div class="form-group">
                        <label for="register-email">E-post</label>
                        <input class="input-field" id="register-email" name="email" type="email" autocomplete="email" required />
                    </div>

                    <div class="form-group">
                        <label for="register-password">Lösenord</label>
                        <input class="input-field" id="register-password" name="password" type="password" autocomplete="new-password" minlength="${minPasswordLength}" required />
                    </div>

                    <div class="button-group">
                        <button class="btn btn-primary" id="register-submit" type="submit">Skapa konto</button>
                        <button class="btn btn-secondary" id="to-login" type="button">Till inloggning</button>
                    </div>

                    <p id="register-message" style="margin-top: 12px;"></p>
                </form>
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

    toLoginButton.addEventListener("click", () => {
        navigateTo("/login");
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
            message.textContent = validationMessages.requiredField;
            return;
        }

        if (countLetters(firstName) < minNameLetters) {
            message.textContent = validationMessages.firstNameTooShort.replace("{min}", String(minNameLetters));
            return;
        }

        if (countLetters(lastName) < minNameLetters) {
            message.textContent = validationMessages.lastNameTooShort.replace("{min}", String(minNameLetters));
            return;
        }

        if (hasBlockedWord(firstName) || hasBlockedWord(lastName)) {
            message.textContent = validationMessages.blockedName;
            return;
        }

        if (String(password).length < minPasswordLength) {
            message.textContent = validationMessages.passwordTooShort.replace("{min}", String(minPasswordLength));
            return;
        }

        if (requirePasswordLetter && !hasAnyLetter(password)) {
            message.textContent = validationMessages.passwordMissingLetter;
            return;
        }

        if (requirePasswordNumber && !hasAnyNumber(password)) {
            message.textContent = validationMessages.passwordMissingNumber;
            return;
        }

        submitButton.disabled = true;
        message.textContent = "Skapar konto...";

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
                message.textContent = "Konto skapat. Omdirigerar...";
                navigateTo("/", { replace: true });
                return;
            }

            message.textContent = "Konto skapat. Kontrollera din e-post och logga in.";
            navigateTo("/login", { replace: true });
        } catch (error) {
            message.textContent = error?.message || "Registrering misslyckades.";
        } finally {
            submitButton.disabled = false;
        }
    });
}
