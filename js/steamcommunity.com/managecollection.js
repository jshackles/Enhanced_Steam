var selection, lastSelected;
var form_id, form_sessionid;

$(document).ready(function() {
	storage.get('overrideworkshopcollection', function(settings) {
		if (settings.overrideworkshopcollection)
			init();
	});
});

/** Initialises the collection overrider. */
function init() {
	// Store existing form variables for easy access
	form_id = $('#AddChildItemForm').get(0).id.value;
	form_sessionid = $('#AddChildItemForm').get(0).sessionid.value;

	// Existing collection body
	var existing = $('.manageCollectionItemsBody')
		.css({display: "none"});

	// Create a new body container
	var body = $('<div class="manageCollectionItemsBody"></div>')
		.insertAfter(existing);

	// Create the two lists and divider
	var notCollectionPane = $('<div class="item-list-container" data-list-in-collection="false"><div class="collectionAddItemsTitle">Items <strong>not</strong> in your collection</div><ul class="item-list"></ul></div>');
	var buttonDivider = $('<div class="button-divider"></div>');
	var inCollectionPane = $('<div class="item-list-container" data-list-in-collection="true"><div class="collectionAddItemsTitle">Items in your collection</div><ul class="item-list"></ul></div>');

	$('<div class="item-list-master-container">')
		.appendTo(body)
		.append(notCollectionPane)
		.append(buttonDivider)
		.append(inCollectionPane);


	// Add filter boxes
	$('<input type="search" class="item-filter-input" placeholder="Filter by name or author">')
		.on('input', filterItemList)
		.insertBefore([notCollectionPane.find('ul'), inCollectionPane.find('ul')]);


	// Add buttons to divider
	$('<a class="es-btn" data-action="toggle-in-collection"><span>&mdash;</span></a>')
		.on('click', toggleInCollection)
		.appendTo(buttonDivider);

	// Move save button
	$('.editCollectionControls').detach().appendTo(body);

	// Recreate all choice items (that are not currently in the collection)
	$('.itemChoice:not(.inCollection)').each(function(_, el) {
		var $el = $(el);
		var title = $el.find('.itemChoiceTitle').html().trim(), // Using .html rather than .text because in the case of < or > .text will return those as-is, rather than &lt; or &gt;
			author = $el.find('.itemChoiceCreator').html().trim().substring(4), // (Will help stop XSS attack if a user named an item like `<script>alert('xss');</script>` )
			itemId = el.id.substr(el.id.lastIndexOf("_") + 1), // Example of el.id: "choice_MySubscribedItems_153370123"
			type = ($el.find('.itemChoiceType').html() || "item").trim().toLowerCase(); // Get the type of choice item ("Collection" or "Item")

		if (type == "item")
			createChoiceItem(title, author, itemId)
				.appendToSorted(notCollectionPane.find('ul'), '.item-title');

		else if (type == "collection")
			{ /* TODO: do something with collections */ }
	});

	// Recreate all choice items that are currently in the collection (done separately from the ones not in collection as these need to be sorted in the order they appear, not alphabetically)
	$('[name="ChildItemsForm"] .managedCollectionItem').each(function(_, el) {
		var $el = $(el);
		var title = $el.find('.workshopItemTitle').html().trim(),
			author = $el.find('.workshopItemAuthorName').html().trim(),
			itemId = el.id.substr(el.id.lastIndexOf("_") + 1); // Example of el.id: "sharedfile_534343032"
		
		createChoiceItem(title, author, itemId)
			.appendTo(inCollectionPane.find('ul'));
	})

	// Listen for drag events in the inCollectionPane
	inCollectionPane.find('ul').on('mousedown', 'li', startItemDrag);
}

/** Creates and returns a jQuery choice item element with the given title, author and itemId. */
function createChoiceItem(title, author, itemId) {
	return $('<li><span class="item-title">' +title + '</span><span class="dim-text">Author: </span><span class="item-author">' + author + '</span></li>')
		.data('item-id', itemId)
		.data('include-filter', true)
		.on('click', selectItem)
		.on('dblclick', toggleInCollection);
}


// --------------- //
// Item selection //
// ------------- //
/** Handles clicking on a selectable item. */
function selectItem(e) {
	var $el = $(this);
	var sameStatus = lastSelected && (elementInCollection($el) == elementInCollection(lastSelected)); // True if the item just clicked and the previously clicked items are both in or both out of the collection

	if (e.shiftKey && sameStatus) {
		// select all elements between just clicked and last clicked
		var i0 = $el.index(), i1 = lastSelected.index();
		selection = $el.closest('ul').children().slice(Math.min(i0, i1), Math.max(i0, i1) + 1);

	} else if (e.ctrlKey && sameStatus) {
		// add/remove the just clicked into the selection
		var i = selection.get().indexOf($el.get(0));
		if (i > -1)
			selection.splice(i, 1);
		else
			selection.push($el.get(0));

	} else {
		// simply select the clicked element
		selection = $el;
	}

	// Update selection classes
	$('.item-selected').removeClass('item-selected');
	selection.addClass('item-selected');

	// update toggle button icon based on whether the selection is in collection or not
	$('[data-action="toggle-in-collection"] span').html(elementInCollection(selection) ? "&lsaquo;" : "&rsaquo;");

	// Store this element as the last clicked element
	lastSelected = $el;
}

/** Returns true if the given element is in the collection. */
function elementInCollection(el) {
	return el.closest('.item-list-container').is('[data-list-in-collection="true"]');
}


// ---------------- //
// Request methods //
// -------------- //
/** Toggles whether the current selection is in the collection or not. */
function toggleInCollection() {
	var sic = elementInCollection(selection);
	var f = sic ? postRemoveItemFromCollection : postAddItemToCollection; // Get the function needed (function to either add to collection if not in or vice-versa)

	// Store the filtered results as the new selection so that if the user selects items, filters some out then toggles, we don't end up with a selection in both lists.
	selection = selection.filter(function(i, el) { // Ignore excluded items
		return !!$(el).data('include-filter');
		
	}).each(function(i, el) { // Loop through all items in selection
		var $el = $(el)
			.addClass('loading-overlay');

		f($el.data('item-id')).done(function(success) {
			if (success) {
				$el.detach();

				if (sic) $el.appendToSorted('.item-list-container[data-list-in-collection="false"] ul', '.item-title') // Move element to not-in-collection list (and sort alphabetically)
				else $el.appendTo('.item-list-container[data-list-in-collection="true"] ul', '.item-title'); // Move element to in-collection list (but do NOT sort alphabetically, add at end)
			}

			$el.removeClass('loading-overlay');
		});
	});

	// In case the selection has changed, update the selection classes
	$('.item-selected').removeClass('item-selected');
	selection.addClass('item-selected');
}

/** Sends a POST request to add an item to the current collection.
 * Returns a Deferred that resolves `done` with success as true or false. */
function postAddItemToCollection(itemId) {
	return $.ajax({
		url: "http://steamcommunity.com/sharedfiles/addchild",
		method: "POST",
		data: {
			id: form_id,
			sessionid: form_sessionid,
			childid: itemId
		}
	}).then(function(resp) {
		return resp.indexOf("<title>Steam Community :: Error</title>") == -1;
	});
}

/** Sends a POST request to remove an item from the current collection.
 * Returns a Deferred that resolves `done` with success as true or false. */
function postRemoveItemFromCollection(itemId) {
	return $.ajax({
		url: "http://steamcommunity.com/sharedfiles/removechild",
		method: "POST",
		data: {
			id: form_id,
			sessionid: form_sessionid,
			childid: itemId,
			ajax: true
		}
	}).then(function(json) {
		return !!json.success;
	})
}


// --------------- //
// Item filtering //
// ------------- //
function filterItemList() {
	var searchTerm = $(this).val();
	$(this).parent().find('ul').children().each(function(i, el) {
		var $el = $(el);
		var enabled = searchText($el.find('.item-title').text(), searchTerm) || searchText($el.find('.item-author').text(), searchTerm);
		$el.data('include-filter', enabled)
			.css('display', enabled ? "list-item" : "none");
	})
}

/** Returns true if the given needle is in the haystack. */
function searchText(haystack, needle) {
	if (needle == "") return true;
	return haystack.toLowerCase().indexOf(needle.toLowerCase()) > -1;
}

/** Setups up listeners for dragging a list item. */
function startItemDrag(e) {
	if (e.offsetX > 46) return; // If the user didn't click on the drag icon part, do nothing

	var $el = $(this), $ul = $(this).parent(),
		dragIndicator = $('<li class="drag-destination"></li>'),
		index; // index stores the new index of the item in the list (relative to the visible items, may be out of upper bounds)

	$el.css('display', "none").before(dragIndicator); // Hide clicked element and add the drag indicator at this element's position

	// Setup mouse move event
	var mm;
	$(document).on('mousemove', mm = function(e) {
		var mouseY = e.pageY - $ul.offset().top;
		index = Math.max(Math.round(mouseY / 54), 0); // 54 is height of a choice list item

		// Get the child that the user's mouse is currently over
		var insertBefore = $($ul.children().filter(function() {
			return !$(this).is('.drag-destination') && $(this).css('display') == "list-item"; // Ensure we don't select the drag indicator, and we only select visible elements
		}).get(index));
		
		if (insertBefore.length)
			dragIndicator.detach().insertBefore(insertBefore); // If that element exists, move the indicator in front of that item
		else
			dragIndicator.detach().appendTo($ul); // If that item doesn't exist, the user must be past the end of the list so just add the indicator to the end
	});

	// Setup mouse release event
	$(document).one('mouseup', function() {
		$el.detach().insertBefore(dragIndicator) // Move the dragged element to the position of the drag indicator
			.css('display', "list-item");
		dragIndicator.remove();

		// Compile the data to send to the server
		var data = {
			id: form_id,
			sessionid: form_sessionid
		};
		$ul.children().each(function(i) {
			data['children[' + $(this).data('item-id') + '][sort_order]'] = i;
		});
		
		// Send request to server to update order
		$.ajax({
			url: "http://steamcommunity.com/sharedfiles/setcollectionsortorder",
			method: "POST",
			data: data

		}).done(function(d) {
			if (d.success != 1)
				alert("An error occured while trying to update the order of the items.");
		});

		$(document).off('mousemove', mm);
	});
}

/** Appends the element to the given parent and sorts the position of this element based on the other children. */
$.fn.appendToSorted = function(parent, sortElementSelector) {
	var $parent = $(parent);
	return this.each(function() {
		var $toAdd = $(this),
			toAddVal = $(this).find(sortElementSelector).text().toLowerCase(),
			beenAdded = false;

		$parent.children().each(function(i) {
			if (beenAdded) return; // Do nothing if we've already found the place for the child

			var thisChildVal = $(this).find(sortElementSelector).text().toLowerCase();

			if (toAddVal < thisChildVal) { // While toAdd is less, keep looking but as soon as it's greater add it before this child
				$(this).before($toAdd);
				beenAdded = true;
			}
		});

		// If we've checked over all children and NOT added the item yet, add it at the very end
		if (!beenAdded)
			$parent.append($toAdd);
	});
};