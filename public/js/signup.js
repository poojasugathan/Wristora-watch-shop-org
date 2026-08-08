const signupForm = document.getElementById("signupForm");

signupForm.addEventListener("submit", function (event) {

    const terms = document.getElementById("termsAccepted");

    if (!terms.checked) {
        event.preventDefault();

        alert("Please accept the Terms of Use and Privacy Policy.");
    }

});