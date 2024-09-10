window.addEventListener("load", () => {
    const previews = Array.from(document.getElementsByClassName("rd-sheet-selector-previews")[0].children);

    const preview = (elem) => {
        let index = parseInt(elem.dataset.previewIndex ?? -1);
        if (index < 0) {
            return;
        }

        previews.forEach((p) => {
            p.classList.remove("selected");
            p.ariaHidden = true;
        });
        previews[index].classList.add("selected");
        previews[index].ariaHidden = false;
    }

    const radios = Array.from(document.querySelectorAll('.rd-sheet-preview input[type="radio"]'))
    radios.forEach(radio => radio.addEventListener("click", () => preview(radio)))

    // Show the preview for any default selected option when the page loads
    const currentlySelected = document.querySelector('.rd-sheet-preview input[type="radio"]:checked');
    preview(currentlySelected);
});