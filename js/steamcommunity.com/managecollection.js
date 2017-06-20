var selection, lastSelected;
var form_id, form_sessionid;

$(document).ready(function() {

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
	$('<a class="es-btn" data-action="toggle-in-collection"><span>&nbsp;</span></a>')
		.on('click', toggleInCollection)
		.appendTo(buttonDivider);

	// Move save button
	$('.editCollectionControls').detach().appendTo(body);

	// Recreate all choice items
	$('.itemChoice').each(function(_, el) {
		var $el = $(el); // Example of el.id: "choice_MySubscribedItems_153370123"

		var title = $el.find('.itemChoiceTitle').html().trim(), // Using .html rather than .text because in the case of < or > .text will return those as-is, rather than &lt; or &gt;
			author = $el.find('.itemChoiceCreator').html().trim().substring(4), // (Will help stop XSS attack if a user named an item like `<script>alert('xss');</script>` )
			itemId = el.id.substr(el.id.lastIndexOf("_") + 1);

		$('<li><span class="item-title">' +title + '</span><span class="dim-text">Author: </span><span class="item-author">' + author + '</span></li>')
			.data('item-id', itemId)
			.on('click', selectItem)
			.on('dblclick', toggleInCollection)
			.appendTo(($el.hasClass('inCollection') ? inCollectionPane : notCollectionPane).find('ul'));
	});
});


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
			if (success)
				$el.detach().appendTo('.item-list-container[data-list-in-collection="' + (sic ? "false" : "true") + '"] ul'); // Move element to other list

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