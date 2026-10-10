// Sales report page: show the From / To dates only for "Custom".
// The server checks the dates again - this is only for convenience.
(function () {

    "use strict";

    const dates = document.getElementById("sr-dates");
    const radios = document.querySelectorAll('#sr-filter input[name="period"]');

    if (!dates || radios.length === 0) {
        return;
    }

    radios.forEach((radio) => {

        radio.addEventListener("change", () => {

            dates.hidden = radio.value !== "custom";

            document.querySelectorAll(".sr-period").forEach((label) => {
                label.classList.toggle(
                    "active",
                    label.contains(radio) && radio.checked
                );
            });
        });
    });

})();
