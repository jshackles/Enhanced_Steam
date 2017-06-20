var selection;
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


	// Add buttons to divider
	$('<a class="es-btn" data-action="toggle-in-collection"><span>&nbsp;</span></a>')
		.on('click', toggleInCollection)
		.appendTo(buttonDivider);

	// Create save button
	$('<div class="editCollectionControls"><a href="#" class="btn_darkblue_white_innerfade btn_medium saveCollection"><span>Save and Continue</span></a><div style="clear: right"></div></div>')
		.on('click', function() { /* Do whatever */ } )
		.appendTo(body);

	// Recreate all choice items
	$('.itemChoice').each(function(_, el) {
		var $el = $(el); // Example of el.id: "choice_MySubscribedItems_153370123"

		var title = $el.find('.itemChoiceTitle').html().trim(), // Using .html rather than .text because in the case of < or > .text will return those as-is, rather than &lt; or &gt;
			author = $el.find('.itemChoiceCreator').html().trim().substring(4), // (Will help stop XSS attack if a user named an item like `<script>alert('xss');</script>` )
			itemId = el.id.substr(el.id.lastIndexOf("_") + 1);

		$('<li><span class="item-title">' +title + '</span><span class="item-author"><span class="dim-text">Author: </span>' + author + '</span></li>')
			.data('item-id', itemId)
			.on('click', selectItem)
			.appendTo(($el.hasClass('inCollection') ? inCollectionPane : notCollectionPane).find('ul'));
	});
});

function selectItem(e) {
	var $el = $(this);

	$('.item-selected').removeClass('item-selected');
	$el.addClass('item-selected');

	selection = $el;

	// update toggle button icon based on whether the selection is in collection or not
	$('[data-action="toggle-in-collection"] span').html(selectionInCollection() ? "&lsaquo;" : "&rsaquo;");
}

/** Returns true if the selection contains items that are currently in the collection. */
function selectionInCollection() {
	return selection.closest('.item-list-container').is('[data-list-in-collection="true"]');
}

/** Toggles whether the current selection is in the collection or not. */
function toggleInCollection() {
	var sic = selectionInCollection();
	var f = sic ? postRemoveItemFromCollection : postAddItemToCollection; // Get the function needed (function to either add to collection if not in or vice-versa)

	selection.each(function(i, el) { // Loop through all items in selection
		var $el = $(el)
			.addClass('loading-overlay');

		f($el.data('item-id')).done(function(success) {
			if (success)
				$el.detach().appendTo('.item-list-container[data-list-in-collection="' + (sic ? "false" : "true") + '"] ul'); // Move element to other list

			$el.removeClass('loading-overlay');
		});
	});
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






/*$(document).ready(function(){

	$('.itemChoice').each(function(_, el) {

		var $el = $(el);
		var itemId = el.id.substr(el.id.lastIndexOf("_") + 1); // Example of el.id: "choice_MySubscribedItems_153370123"

		var $controls = $el.find('.itemChoiceControls').empty();
		$('<div class="itemChoiceAddItem"><a href="#" class="general_btn">Add</a></div>')
			.on('click', AddChoiceItem)
			.appendTo($controls);
		$('<div class="itemChoiceRemoveItem"><a href="#" class="general_btn">Remove</a></div>')
			.on('click', RemoveChoiceItem)
			.appendTo($controls);
		$('<div class="itemChoiceViewDetails"><a href="http://steamcommunity.com/sharedfiles/filedetails?id=' + itemId + '" target="_blank" class="general_btn">Details</a></div>')
			.appendTo($controls);
	});
});

function AddChoiceItem(e) {
	var itemEl = $(e.target).closest('.itemChoice'),
		form = $('#AddChildItemForm'),
		choiceId = "";

	if (itemEl.hasClass('inCollection'))
		return;

	itemEl.addClass("loading");

	form.get(0).childid.value = choiceId;
	$.ajax({
		url: "http://steamcommunity.com/sharedfiles/addchild",
		method: "POST",
		data: form.serialize()

	}).done(function(responseHtml) {
		var hasError = responseHtml.indexOf("<title>Steam Community :: Error</title>") > -1;
		console.log(responseHtml);

		if (hasError)
			alert("An error occured while adding this item to the collection.");
		else
			itemEl.addClass("inCollection");

		itemEl.removeClass("loading");
	});

//	var elem = $( elemID );
//	if ( elem.hasClassName( "inCollection" ) )
//		return;
//	$( 'AddChildItemForm' ).childid.value = childID;
//	$( 'AddChildItemForm' ).submit();
}

function RemoveChoiceItem() {

}*/