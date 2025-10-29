window.addEventListener("load", () => {
    const previewBlocks = Array.from(document.getElementsByClassName("rd-sheet-selector-previews"));
    const previews = previewBlocks.flatMap(b => Array.from(b.children))

    const preview = (elem) => {
        if (!elem) {
            return;
        }

        previews.forEach((p) => {
            p.classList.remove("selected");
            p.ariaHidden = true;
        });

        let index = parseInt(elem.dataset.previewIndex ?? -1);      

        if (index < 0) {
            return;
        }

        
        previews[index].classList.add("selected");
        previews[index].ariaHidden = false;
    }

    const radios = Array.from(document.querySelectorAll('.rd-sheet-preview input[type="radio"]'))
    radios.forEach(radio => radio.addEventListener("click", () => preview(radio)))

    // Show the preview for any default selected option when the page loads
    const currentlySelected = document.querySelector('.rd-sheet-preview input[type="radio"]:checked');
    preview(currentlySelected);
});
