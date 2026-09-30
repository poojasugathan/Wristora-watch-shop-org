const signupForm = document.getElementById("signupForm");

// Short display labels for each required field
const fieldLabels = {
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone number",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    termsAccepted: "Terms acceptance"
};

const requiredFieldNames = Object.keys(fieldLabels);

function showErrors(messages) {
    let errorBox = document.querySelector(".signup-errors");

    if (!errorBox) {
        errorBox = document.createElement("div");
        errorBox.className = "signup-errors";
        signupForm.parentNode.insertBefore(errorBox, signupForm);
    }

    errorBox.innerHTML = "";

    messages.forEach((msg) => {
        const line = document.createElement("div");
        line.textContent = msg;
        errorBox.appendChild(line);
    });

    errorBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearErrors() {
    const errorBox = document.querySelector(".signup-errors");

    if (errorBox) {
        errorBox.remove();
    }
}

function getMissingFields() {
    return requiredFieldNames.filter((name) => {
        if (name === "termsAccepted") {
            return !document.getElementById("termsAccepted").checked;
        }

        const field = signupForm.querySelector(`[name="${name}"]`);
        return field && field.value.trim() === "";
    });
}

function validateSignupForm() {
    const messages = [];
    const missingFields = getMissingFields();

    if (missingFields.length > 0) {
        // If most of the form is empty, give one generic message.
        // If only a couple of fields are missing, name them specifically.
        if (missingFields.length > requiredFieldNames.length / 2) {
            messages.push("All fields are required.");
        } else {
            const labels = missingFields.map((name) => fieldLabels[name]);
            const verb = labels.length > 1 ? "are" : "is";

            messages.push(`${labels.join(", ")} ${verb} required.`);
        }
    }

    // Format / match checks only make sense once a field actually has a value
    const email = signupForm.querySelector('[name="email"]');
    if (email.value.trim() !== "" && email.validity.typeMismatch) {
        messages.push("Enter a valid email address.");
    }

    const password = signupForm.querySelector('[name="password"]').value;
    const confirmPassword = signupForm.querySelector('[name="confirmPassword"]').value;

    if (password && confirmPassword && password !== confirmPassword) {
        messages.push("Passwords do not match.");
    }

    return messages;
}

signupForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const messages = validateSignupForm();

    if (messages.length > 0) {
        showErrors(messages);
        return;
    }

    clearErrors();
    signupForm.submit();
});