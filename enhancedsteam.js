// version 4.0
var storage = chrome.storage.sync;
var apps;
var language;
var info = 0;
var isSignedIn = false;
var signedInChecked = false;

storage.get(function (settings) {
	language = settings.language || "en";
});

// Global scope promise storage; to prevent unecessary API requests.
var loading_inventory;
var appid_promises = {};

var library_all_games = [];

//Chrome storage functions.
function setValue(key, value) {
	sessionStorage.setItem(key, JSON.stringify(value));
}

function getValue(key) {
	var v = sessionStorage.getItem(key);
	if (v === undefined) return v;
	return JSON.parse(v);
}

// Helper prototypes
String.prototype.startsWith = function(prefix) {
	return this.indexOf(prefix) === 0;
};

function formatMoney (number, places, symbol, thousand, decimal, right) {
	places = !isNaN(places = Math.abs(places)) ? places : 2;
	symbol = symbol !== undefined ? symbol : "$";
	thousand = thousand || ",";
	decimal = decimal || ".";
	var negative = number < 0 ? "-" : "",
		i = parseInt(number = Math.abs(+number || 0).toFixed(places), 10) + "",
		j = (j = i.length) > 3 ? j % 3 : 0;
	if (right) {
		return negative + (j ? i.substr(0, j) + thousand : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousand) + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) + symbol: "");
	} else {
		return symbol + negative + (j ? i.substr(0, j) + thousand : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousand) + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) : "");
	}
};

function escapeHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') ;
}

// DOM helpers
function xpath_each(xpath, callback) {
	//TODO: Replace instances with jQuery selectors.
	var res = document.evaluate(xpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
	var node;
	for (var i = 0; i < res.snapshotLength; ++i) {
		node = res.snapshotItem(i);
		callback(node);
	}
}

function get_http(url, callback) {
	var http = new XMLHttpRequest();
	http.onreadystatechange = function () {
		if (this.readyState == 4 && this.status == 200) {
			callback(this.responseText);
		}
	};
	http.open('GET', url, true);
	http.send(null);
}

function get_appid(t) {
	if (t && t.match(/(?:store\.steampowered|steamcommunity)\.com\/app\/(\d+)\/?/)) return RegExp.$1;
	else return null;
}

function get_subid(t) {
	if (t && t.match(/(?:store\.steampowered|steamcommunity)\.com\/sub\/(\d+)\/?/)) return RegExp.$1;
	else return null;
}

function get_appid_wishlist(t) {
	if (t && t.match(/game_(\d+)/)) return RegExp.$1;
	else return null;
}

function ensure_appid_deferred(appid) {
	if (!appid_promises[appid]) {
		var deferred = new $.Deferred();
		appid_promises[appid] = {
			"resolve": deferred.resolve,
			"promise": deferred.promise()
		};
	}
}

// check if the user is signed in
function is_signed_in() {
	if (!signedInChecked) {
		var cookies = document.cookie.split("; ");
		for (var cookie in cookies) {
			cookie = cookies[cookie].split("=");
			if (cookie[0] == "steamLogin") {
				isSignedIn = cookie[1].replace(/%.*/, "");
			}
		}
		signedInChecked = true;
	}
	return isSignedIn;
}

// colors the tile for owned games
function highlight_owned(node) {
	storage.get(function(settings) {
		if (settings.highlight_owned_color === undefined) { settings.highlight_owned_color = "#5c7836";	storage.set({'highlight_owned_color': settings.highlight_owned_color}); }
		if (settings.highlight_owned === undefined) { settings.highlight_owned = true; storage.set({'highlight_owned': settings.highlight_owned}); }
		if (settings.hide_owned === undefined) { settings.hide_owned = false; chrome.storage.sync.set({'hide_owned': settings.hide_owned}); }

		if (settings.highlight_owned) highlight_node(node, settings.highlight_owned_color);
		if (settings.hide_owned) hide_node(node);

		if (settings.tag_owned === undefined) { settings.tag_owned = false; storage.set({'tag_owned': settings.tag_owned}); }
		if (settings.tag_owned_color === undefined) { settings.tag_owned_color = "#5c7836";	storage.set({'tag_owned_color': settings.tag_owned_color}); }
		if (settings.tag_owned) add_tag(node, localized_strings[language].tag_owned, settings.tag_owned_color);
	});
}

// colors the tile for wishlist games
function highlight_wishlist(node) {
	storage.get(function(settings) {
		if (settings.highlight_wishlist_color === undefined) { settings.highlight_wishlist_color = "#496e93";	storage.set({'highlight_wishlist_color': settings.highlight_wishlist_color}); }
		if (settings.highlight_wishlist === undefined) { settings.highlight_wishlist = true; storage.set({'highlight_wishlist': settings.highlight_wishlist}); }
		if (settings.highlight_wishlist) highlight_node(node, settings.highlight_wishlist_color);

		if (settings.tag_wishlist_color === undefined) { settings.tag_wishlist_color = "#496e93";	storage.set({'tag_wishlist_color': settings.tag_wishlist_color}); }
		if (settings.tag_wishlist === undefined) { settings.tag_wishlist = false; storage.set({'tag_wishlist': settings.tag_wishlist}); }
		if (settings.tag_wishlist) add_tag(node, localized_strings[language].tag_wishlist, settings.highlight_wishlist_color);
	});
}

// colors the tile for items with coupons
function highlight_coupon(node) {
	storage.get(function(settings) {
		if (settings.highlight_coupon_color === undefined) { settings.highlight_coupon_color = "#6b2269"; storage.set({'highlight_coupon_color': settings.highlight_coupon_color}); }
		if (settings.highlight_coupon === undefined) { settings.highlight_coupon = false; storage.set({'highlight_coupon': settings.highlight_coupon}); }
		if (settings.highlight_coupon) highlight_node(node, settings.highlight_coupon_color);

		if (settings.tag_coupon_color === undefined) { settings.tag_coupon_color = "#6b2269"; storage.set({'tag_coupon_color': settings.tag_coupon_color}); }
		if (settings.tag_coupon === undefined) { settings.tag_coupon = true; storage.set({'tag_coupon': settings.tag_coupon}); }
		if (settings.tag_coupon) add_tag(node, localized_strings[language].tag_coupon, settings.highlight_coupon_color);
	});
}

// colors the tile for items in inventory
function highlight_inv_gift(node) {
	storage.get(function(settings) {
		if (settings.highlight_inv_gift_color === undefined) { settings.highlight_inv_gift_color = "#a75124"; storage.set({'highlight_inv_gift_color': settings.highlight_inv_gift_color}); }
		if (settings.highlight_inv_gift === undefined) { settings.highlight_inv_gift = false; storage.set({'highlight_inv_gift': settings.highlight_inv_gift}); }
		if (settings.highlight_inv_gift) highlight_node(node, settings.highlight_inv_gift_color);

		if (settings.tag_inv_gift_color === undefined) { settings.tag_inv_gift_color = "#a75124"; storage.set({'tag_inv_gift_color': settings.tag_inv_gift_color}); }
		if (settings.tag_inv_gift === undefined) { settings.tag_inv_gift = true; storage.set({'tag_inv_gift': settings.tag_inv_gift}); }
		if (settings.tag_inv_gift) add_tag(node, localized_strings[language].tag_inv_gift, settings.highlight_inv_gift_color);
	});
}

// colors the tile for items in inventory
function highlight_inv_guestpass(node) {
	storage.get(function(settings) {
		if (settings.highlight_inv_guestpass_color === undefined) { settings.highlight_inv_guestpass_color = "#a75124"; storage.set({'highlight_inv_guestpass_color': settings.highlight_inv_guestpass_color}); }
		if (settings.highlight_inv_guestpass === undefined) { settings.highlight_inv_guestpass = false; storage.set({'highlight_inv_guestpass': settings.highlight_inv_guestpass}); }
		if (settings.highlight_inv_guestpass) highlight_node(node, settings.highlight_inv_guestpass_color);

		if (settings.tag_inv_guestpass_color === undefined) { settings.tag_inv_guestpass_color = "#a75124"; storage.set({'tag_inv_guestpass_color': settings.tag_inv_guestpass_color}); }
		if (settings.tag_inv_guestpass === undefined) { settings.tag_inv_guestpass = true; storage.set({'tag_inv_guestpass': settings.tag_inv_guestpass}); }
		if (settings.tag_inv_guestpass) add_tag(node, localized_strings[language].tag_inv_guestpass, settings.highlight_inv_guestpass_color);
	});
}

function highlight_friends_want(node, appid) {
	storage.get(function(settings) {
		if (settings.highlight_friends_want === undefined) { settings.highlight_friends_want = false; storage.set({'highlight_friends_want': settings.highlight_friends_want});}
		if (settings.highlight_friends_want_color === undefined) { settings.highlight_friends_want_color = "#7E4060"; storage.set({'highlight_friends_want_color': settings.highlight_friends_want_color});}
		if (settings.highlight_friends_want) highlight_node(node, settings.highlight_friends_want_color);

		if (settings.tag_friends_want === undefined) { settings.tag_friends_want = true; storage.set({'tag_friends_want': settings.tag_friends_want});}
		if (settings.tag_friends_want_color === undefined) { settings.tag_friends_want_color = "#7E4060"; storage.set({'tag_friends_want_color': settings.tag_friends_want_color});}
		if (settings.tag_friends_want) add_tag(
			node,
			localized_strings[language].tag_friends_want.replace("__appid__", appid).replace("__friendcount__", getValue(appid + "friendswant")),
			settings.tag_friends_want_color
		);
	});
}

function highlight_node(node, color) {
	storage.get(function(settings) {
		var $node = $(node);
		// Carousel item
		if (node.classList.contains("cluster_capsule")) {
			$node = $(node).find(".main_cap_content");
		}

		// Genre Carousel items
		if (node.classList.contains("large_cap")) {
			$node = $(node).find(".large_cap_content");
		}

		$node.css("backgroundImage", "none");
		$node.css("backgroundColor", color);

		// Set text colour to not conflict with highlight.
		if (node.classList.contains("tab_row")) $node.find(".tab_desc").css("color", "lightgrey");
		if (node.classList.contains("search_result_row")) $node.find(".search_name").css("color", "lightgrey");
	});
}

function hide_node(node) {
	if (node.classList.contains("search_result_row") || node.classList.contains("tab_row") || node.classList.contains("game_area_dlc_row")) {
		$(node).css("display", "none");
	}
}

function add_tag (node, string, color) {
	/* To add coloured tags to the end of app names instead of colour
	highlighting; this allows an to be "highlighted" multiple times; e.g.
	inventory and owned. */
	node.tags = node.tags || [];
	var tagItem = [string, color];
	var already_tagged = false;

	// Check its not already tagged.
	for (var i = 0; i < node.tags.length; i++) {
		if (node.tags[i][0] === tagItem[0]) already_tagged = true;
	}
	if (!already_tagged) {
		node.tags.push(tagItem);
		display_tags(node);
	}
}

function display_tags(node) {
	var remove_existing_tags = function remove_existing_tags(tag_root) {
		if (tag_root.find(".tags").length > 0) {
			tag_root.find(".tags").remove();
		}
	},
	new_display_tag = function new_display_tag(text, color) {
		var $tag = $("<span>" + tag[0] + "</span>");
		$tag.css("backgroundColor", tag[1]);
		$tag.css("color", "white");
		$tag.css("float", "right");
		$tag.css("padding", "2px");
		$tag.css("margin-right", "4px");
		$tag.css("margin-bottom", "4px");
		$tag.css("border", "1px solid #262627");
		return $tag;
	};

	if (node.tags) {

		// Make tags.
		$tags = $("<div class=\"tags\"></div>");
		for (var i = 0; i < node.tags.length; i++) {
			var tag = node.tags[i];
			var $tag = new_display_tag(tag[0], tag[1]);
			$tags.append($tag);
		}

		// Gotta apply tags differently per type of node.
		var $tag_root;
		if (node.classList.contains("tab_row")) {
			$tag_root = $(node).find(".tab_desc").removeClass("with_discount");
			remove_existing_tags($tag_root);

			$tags.css("margin-right", "76px");
			$tag_root.find("h4").after($tags);
		}
		else if (node.classList.contains("search_result_row")) {
			$tag_root = $(node).find(".search_name");
			remove_existing_tags($tag_root);

			$tags.css("display", "inline-block");
			$tags.css("vertical-align", "middle");
			$tags.css("font-size", "small");

			var $p = $tag_root.find("p"),
				$imgs = $p.find("img").remove(),
				$text = $p.text(),
				$new_p = $("<p></p>");

			$p.replaceWith($new_p.append($imgs).append($tags).append($text));

			// Remove margin-bottom, border, and tweak padding on carousel lists.
			$.each($tag_root.find(".tags span"), function (i, obj) {
				$(obj).css("margin-bottom", "0");
				$(obj).css("border", "0");
				$(obj).css("padding", "3px");
			});
		}
		else if (node.classList.contains("dailydeal")) {
			$tag_root = $(node).parent();
			remove_existing_tags($tag_root);

			$tag_root.find(".game_purchase_action").before($tags);
			$tag_root.find(".game_purchase_action").before($("<div style=\"clear: right;\"></div>"));
		}
		else if (node.classList.contains("small_cap")) {
			$tag_root = $(node);
			remove_existing_tags($tag_root);

			// small_cap will have extra height

			$tags.css("display", "table");
			$tags.css("margin-top", "4px");
			$tag_root.find("h4").before($tags);
		}
		else if (node.classList.contains("game_area_dlc_row")) {
			$tag_root = $(node);
			remove_existing_tags($tag_root);

			var width = $(".game_area_dlc_price").width();
			$tags.css("margin-right", width + 3);
			$tag_root.find(".game_area_dlc_name").before($tags);

			// Remove margin-bottom on DLC lists, else horrible pyramidding.
			$.each($tag_root.find(".tags span"), function (i, obj) {
				$(obj).css("margin-bottom", "0");
				$(obj).css("padding", "0 2px");
			});
		}
		else if (node.classList.contains("wishlistRow")) {
			$tag_root = $(node).find(".wishlistRowItem");
			remove_existing_tags($tag_root);

			$tags.css("float", "left");
			$tag_root.find(".bottom_controls").append($tags);
		}
		else if (node.classList.contains("match")) {
			$tag_root = $(node);
			remove_existing_tags($tag_root);

			$tags.css("float", "right");
			$tags.css("width", "130px");
			$tags.css("margin-top", "30px");
			$tag_root.find(".match_price").after($tags);
		}
		else if (node.classList.contains("cluster_capsule")) {
			$tag_root = $(node);
			remove_existing_tags($tag_root);

			$tags.css("display", "inline-block");
			$tags.css("vertical-align", "middle");
			$tags.css("font-size", "small");
			$tag_root.find(".main_cap_platform_area").append($tags);

			// Remove margin-bottom, border, and tweak padding on carousel lists.
			$.each($tag_root.find(".tags span"), function (i, obj) {
				$(obj).css("margin-bottom", "0");
				$(obj).css("border", "0");
				$(obj).css("padding", "3px");
			});
		}
		else if (node.classList.contains("recommendation_highlight")) {
			$tag_root = $(node);
			remove_existing_tags($tag_root);

			$tags.css("float", "left");

			$tag_root.find(".game_purchase_action").before($tags);
			$tag_root.find(".game_purchase_action").before($("<div style=\"clear: right;\"></div>"));
		}
		else if (node.classList.contains("recommendation_carousel_item")) {
			$tag_root = $(node);
			remove_existing_tags($tag_root);

			$tags.css("float", "left");

			$tag_root.find(".buttons").before($tags);
		}
		else if (node.classList.contains("friendplaytime_game")) {
			$tag_root = $(node);
			remove_existing_tags($tag_root);

			$tags.css("float", "left");

			$tag_root.find(".friendplaytime_buttons").before($tags);
		}
		else if (node.classList.contains("inline_tags")) {
			$tag_root = $(node);
			remove_existing_tags($tag_root.parent());

			$tags.css("display", "inline-block");
			$tags.css("margin-left", "4px");

			$tags.children().remove();
			// display inline as text only.
			$.each(node.tags, function (i, obj) {
				var $obj = $("<span>" + obj[0] + "</span>");
				// $obj.css("border-bottom", "2px solid " + obj[1]);
				// $obj.css("background-color", obj[1]);
				// $obj.css("color", "white");

				if (i === 0) $tags.append(" (");
				$tags.append($obj);
				if (i === node.tags.length - 1) {
					$tags.append(")");
				}
				else {
					$tags.append(", ");
				}
			});
			$tag_root.after($tags);
		}
		else if (node.classList.contains("apphub_HeaderStandardTop")) {
			$tag_root = $(node);
			$tag_root.css("height", "60px"); // Height to accomodate tags.

			remove_existing_tags($tag_root);

			$tags.css("float", "left");
			$tags.css("margin-top", "4px");
			$tags.css("margin-left", "4px");

			$tag_root.find(".apphub_AppName").after($tags);
			$tag_root.find(".apphub_AppName").after($("<div style=\"clear: right;\"></div>"));
		}
		else if (node.classList.contains("apphub_HeaderTop")) {
			$tag_root = $(node);
			$tag_root.css("height", "90px"); // Height to accomodate tags.
			$tag_root.find(".apphub_sectionTabs").css("padding-top", "2px"); // Height to accomodate tags.

			remove_existing_tags($tag_root);

			$tags.css("float", "left");
			$tags.css("margin-top", "4px");
			$tags.css("margin-left", "4px");

			$tag_root.find(".apphub_AppName").after($tags);
			$tag_root.find(".apphub_AppName").after($("<div style=\"clear: right;\"></div>"));
		}
	}
}

function load_inventory() {
	if ($(".user_avatar").length > 0) { var profileurl = $(".user_avatar")[0].href || $(".user_avatar a")[0].href; }
	var gift_deferred = new $.Deferred();
	var coupon_deferred = new $.Deferred();
	var card_deferred = new $.Deferred();

	var handle_inv_ctx1 = function (txt) {
		if (txt.charAt(0) != "<") {

			localStorage.setItem("inventory_1", txt);
			var data = JSON.parse(txt);
			if (data.success) {
				$.each(data.rgDescriptions, function(i, obj) {
					if (obj.actions) {
						var appid = get_appid(obj.actions[0].link);
						setValue(appid + (obj.type === "Gift" ? "gift" : "guestpass"), true);
					}
				});
			}
			gift_deferred.resolve();
		}
	};

	var handle_inv_ctx6 = function (txt) {
		if (txt) {
			if (txt.charAt(0) != "<") {
				localStorage.setItem("inventory_6", txt);
				var data = JSON.parse(txt);
				if (data.success) {
					$.each(data.rgDescriptions, function(i, obj) {
						if (obj.market_name) {
							setValue("card:" + obj.market_name, true);
						}
					});
				}
				card_deferred.resolve();
			}
		}
	};

	var handle_inv_ctx3 = function (txt) {
		if (txt.charAt(0) != "<") {
			localStorage.setItem("inventory_3", txt);
			var data = JSON.parse(txt);
			if (data.success) {
				$.each(data.rgDescriptions, function(i, obj) {
					var appid;
					if (obj.type === "Coupon") {
						if (obj.actions) {
							var packageids = [];
							for (var j = 0; j < obj.actions.length; j++) {
								//obj.actions[j]
								var link = obj.actions[j].link;
								var packageid = /http:\/\/store.steampowered.com\/search\/\?list_of_subs=([0-9]+)/.exec(link)[1];

								// If sub+packageid is in localStorage then we don't need to get this info reloaded.
								// This sick optimization saves 268ms per page load! Woo!
								if (!getValue("sub" + packageid)) packageids.push(packageid);
							}
							if (packageids.length > 0){
								get_http("//store.steampowered.com/api/packagedetails/?packageids=" + packageids.join(","), function(txt) {
									var package_data = JSON.parse(txt);
									$.each(package_data, function(package_id, _package) {
										if (_package.success) {
											setValue("sub" + package_id, true);
											$.each(_package.data.apps, function(i, app) {
												setValue(app.id + "coupon", true);
												setValue(app.id + "coupon_sub", package_id);
												setValue(app.id + "coupon_imageurl", obj.icon_url);
												setValue(app.id + "coupon_title", obj.name);
												setValue(app.id + "coupon_discount", obj.name.match(/([1-9][0-9])%/)[1]);
												for (var i = 0; i < obj.descriptions.length; i++) {
													if (obj.descriptions[i].value.startsWith("Can't be applied with other discounts.")) {
														setValue(app.id + "coupon_discount_note", obj.descriptions[i].value);
														setValue(app.id + "coupon_discount_doesnt_stack", true);
													}
													else if (obj.descriptions[i].value.startsWith("(Valid")) {
														setValue(app.id + "coupon_valid", obj.descriptions[i].value);
													}
												};
											});
										}
									});
									coupon_deferred.resolve();
								});
							}
							else {
								coupon_deferred.resolve();
							}
						}
					}
				});
			}
		}
	}

	// Yes caching!

	//TODO: Expire delay in options.
	var expire_time = parseInt(Date.now() / 1000, 10) - 1 * 60 * 60; // One hour ago
	var last_updated = localStorage.getItem("inventory_time") || expire_time - 1;
	if (last_updated < expire_time || !localStorage.getItem("inventory_1") || !localStorage.getItem("inventory_3")) {
		localStorage.setItem("inventory_time", parseInt(Date.now() / 1000, 10))

		// Context ID 1 is gifts and guest passes
		get_http(profileurl + '/inventory/json/753/1/', handle_inv_ctx1);

		// Context ID 3 is coupons
		get_http(profileurl + '/inventory/json/753/3/', handle_inv_ctx3);

		// Context ID 6 is trading card stuff
		get_http(profileurl + '/inventory/json/753/6/', handle_inv_ctx6);
	}
	else {
		// No need to load anything, its all in localStorage.
		handle_inv_ctx1(localStorage.getItem("inventory_1"));
		handle_inv_ctx3(localStorage.getItem("inventory_3"));
		handle_inv_ctx6(localStorage.getItem("inventory_6"));

		gift_deferred.resolve();
		coupon_deferred.resolve();
		card_deferred.resolve();
	}

	var deferred = new $.Deferred();
	$.when.apply(null, [gift_deferred.promise(), card_deferred.promise(), coupon_deferred.promise()]).done(function (){
		deferred.resolve();
	});
	return deferred.promise();
}

function add_empty_wishlist_button() {
	var profile = $(".playerAvatar a")[0].href.replace("http://steamcommunity.com", "");
	if (window.location.pathname.startsWith(profile)) {
		var empty_button = $("<div class='btn_save' style='border-color:red; width: auto;'>&nbsp;&nbsp;<a>" + localized_strings[language].empty_wishlist + "</a>&nbsp;&nbsp;</div>");
		empty_button.click(empty_wishlist);
		$("#games_list_container").after(empty_button);
	}
}

function empty_wishlist() {
	var conf = confirm("Are you sure you want to empty your wishlist?\n\nThis action cannot be undone!");
	if (conf) {
		var deferreds = $(".wishlistRow").map(function(i, $obj) {
			var deferred = new $.Deferred();
			var appid = get_appid_wishlist($obj.id),
				http = new XMLHttpRequest(),
				profile = $(".playerAvatar a")[0].href.replace("http://steamcommunity.com/", "");

			http.onreadystatechange = function () {
				if (this.readyState == 4 && this.status == 200) {
					deferred.resolve();
				}
			};
			http.open('POST', "http://steamcommunity.com/" + profile + "/wishlist/", true);
			http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			http.send("action=remove&appid=" + encodeURIComponent(appid));

			return deferred.promise();
		});

		$.when.apply(null, deferreds).done(function(){
			location.reload();
		});
	}
}

function find_purchase_date(appname) {
	get_http('http://store.steampowered.com/account/', function (txt) {
		var earliestPurchase = $(txt).find("#store_transactions .transactionRowTitle:contains(" + appname + ")").closest(".transactionRow").last(),
			purchaseDate = $(earliestPurchase).find(".transactionRowDate").text();

		var found = 0;
		xpath_each("//div[contains(@class,'game_area_already_owned')]", function (node) {
			if (found === 0) {
				if (purchaseDate) {
					node.innerHTML = node.innerHTML + localized_strings[language].purchase_date.replace("__date__", purchaseDate);
					found = 1;
				}
			}
		});
	});
}

function send_age_verification() {
	document.getElementsByName("ageYear")[0].value="1955";
	document.getElementsByClassName("btn_checkout_green")[0].click();
}

function add_wallet_balance_to_header() {
	$("#global_action_menu").append("<div id='es_wallet' style='text-align:right; padding-right:12px; line-height: normal;'>");
	$("#es_wallet").load('http://store.steampowered.com #header_wallet_ctn');

}

// Adds a link to options to the global menu (where is Install Steam button)
function add_enhanced_steam_options() {
	$dropdown = $("<span class=\"pulldown global_action_link\" id=\"enhanced_pulldown\">Enhanced Steam</span>");
	$dropdown_options_container = $("<div class=\"popup_block\"><div class=\"popup_body popup_menu\"></div></div>");
	$dropdown_options = $dropdown_options_container.find(".popup_body");
	$dropdown_options.css("display", "none");

	// remove menu if click anywhere but on "Enhanced Steam". Commented out bit is for clicking on menu won't make it disappear either.
	$('body').bind('click', function(e) {
		if(/*$(e.target).closest(".popup_body").length == 0 && */$(e.target).closest("#enhanced_pulldown").length == 0) {
			if ($dropdown_options.css("display") == "block" || $dropdown_options.css("display") == "") {
				$dropdown_options.css("display", "none");
			}
		}
	});

	$dropdown.click(function(){
		if ($dropdown_options.css("display") === "none") {
			$dropdown_options.css("display", "");
		}
		else {
			$dropdown_options.css("display", "none");
		}
	});

	$options_link = $("<a class=\"popup_menu_item\" target=\"_blank\" href=\"" + chrome.extension.getURL("options.html") + "\">" + localized_strings[language].options + "</a>");
	$website_link = $("<a class=\"popup_menu_item\" target=\"_blank\" href=\"http://www.enhancedsteam.com\">" + localized_strings[language].website + "</a>");
	$contribute_link = $("<a class=\"popup_menu_item\" target=\"_blank\" href=\"//github.com/jshackles/Enhanced_Steam\">" + localized_strings[language].contribute + "</a>");
	$donation_link = $("<a class=\"popup_menu_item\" target=\"_blank\" href=\"//enhancedsteam.com/donate.php\">" + localized_strings[language].donate + "</a>");

	$clear_cache_link = $("<a class=\"popup_menu_item\" href=\"\">" + localized_strings[language].clear_cache + "</a>");
	$clear_cache_link.click(function(){
		localStorage.clear();
		sessionStorage.clear();
		location.reload();
	});

	$spacer = $("<div class=\"hr\"></div>");

	$dropdown_options.append($options_link);
	$dropdown_options.append($clear_cache_link);
	$dropdown_options.append($spacer);
	$dropdown_options.append($website_link);
	$dropdown_options.append($contribute_link);
	$dropdown_options.append($donation_link);

	$("#global_action_menu")
		.before($dropdown)
		.before($dropdown_options_container);
}

// Removes the "Install Steam" button at the top of each page
function remove_install_steam_button() {
	storage.get(function(settings) {
		if (settings.hideinstallsteambutton === undefined) { settings.hideinstallsteambutton = false; storage.set({'hideinstallsteambutton': settings.hideinstallsteambutton}); }
		if (settings.hideinstallsteambutton) {
			$('div.header_installsteam_btn').replaceWith('');
		}
	});
}

// Removes the About menu item at the top of each page
function remove_about_menu() {
	storage.get(function(settings) {
		if (settings.hideaboutmenu === undefined) { settings.hideaboutmenu = false; storage.set({'hideaboutmenu': settings.hideaboutmenu}); }
		if (settings.hideaboutmenu) {
			$('a[href$="http://store.steampowered.com/about/"]').replaceWith('');
		}
	});
}

// Adds a link to SPUF to the top menu
function add_spuf_link() {
	var supernav_content = document.querySelectorAll("#supernav .supernav_content");
	if ($("#supernav").length > 0) {
		$("a[href='http://steamcommunity.com/workshop/']").after('<a class="submenuitem" href="http://forums.steampowered.com/forums/" target="_blank">' + localized_strings[language].forums + '</a>');
	}
}

// Adds a "Library" menu to the main menu of Steam
function add_library_menu() {
	storage.get(function(settings) {
		if (settings.showlibrarymenu === undefined) { settings.showlibrarymenu = false; storage.set({'showlibrarymenu': settings.showlibrarymenu}); }
		if (settings.showlibrarymenu) {
			$(".menuitem[href='http://steamcommunity.com/']").before("<a class='menuitem' href='#library' id='es_library'>" + localized_strings[language].library_menu + "</a>");

			var showAppInLibrary = function() {
				var appid = window.location.hash.match(/\d+/);
				if (appid && ! isNaN(parseInt(appid[0]))) {
					settings.librarylastappid = appid[0];
					storage.set({'librarylastappid': appid[0]});

					var selectAppInList = function() {
						$(".es_library_app[data-appid='" + $("#es_library_list").data("appid-selected") + "']").removeClass('es_library_selected');
						$(".es_library_app[data-appid='" + settings.librarylastappid + "']").addClass('es_library_selected');
						$("#es_library_list").data("appid-selected", settings.librarylastappid);
						// scroll if found in the app list
						if ($(".es_library_app[data-appid='" + settings.librarylastappid + "']").length != 0) {
							$(".es_library_app[data-appid='" + settings.librarylastappid + "']")[0].scrollIntoView();
						}
					}

					if ($("#es_library_content").length == 0) {
						show_library().then(function() { selectAppInList(); library_show_app(appid[0]) });
					}
					else {
						selectAppInList();
						library_show_app(appid[0]);
					}
				}
			};

			if (window.location.hash == "#library") {
				show_library();
			}
			else if (window.location.hash.startsWith("#library/app/")) {
				showAppInLibrary();
			}

			$(".es_library_app").bind("click", function() {
				showAppInLibrary();
			});

			$(window).bind("hashchange", function() {
				if (window.location.hash == "#library") {
					show_library();
				}
				else if (window.location.hash.startsWith("#library/app/")) {
					showAppInLibrary();
				}
			});
		}
	});
}

function show_library() {
	var deferred = $.Deferred();

	// change page title
	document.title = 'Steam Library';

	// Remove content divs
	$("#es_library_list").remove();
	$("#es_library_right").remove();
	$("#es_library_background_filter").remove();
	$("#es_library_background").remove();
	$("#store_header").remove();
	$("#main").remove();
	$("#footer").remove();
	$("#game_background_holder").remove();
	$("#modalBG").remove();
	$("#page_background_holder").remove();

	// Create Library divs
	var es_library = $("<div id='es_library_content'></div>");
	$("#global_header").after(es_library);
	es_library.append("<div id='es_library_background'></div>");
	es_library.append("<div id='es_library_background_filter'></div>");
	es_library.append("<div id='es_library_right'></div>");
	es_library.append("<div id='es_library_search' style='display: none;'></div>");
	es_library.append("<div id='es_library_list' data-appid-selected='undefined'><div id='es_library_list_loading'><img src='http://cdn.steamcommunity.com/public/images/login/throbber.gif'>Loading...</div></div>");


	storage.get(function(settings) {
		if (settings.showlibraryf2p === undefined) { settings.showlibraryf2p = true; storage.set({'showlibraryf2p': settings.showlibraryf2p}); }
		
		var showlibraryf2p = 1;
		showlibraryf2p = (settings.showlibraryf2p) ? 1 : 0;

		// Call Storefront API
		get_http('http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=A6509A49A35166921243F4BCC928E812&steamid=' + is_signed_in() + '&include_appinfo=1&include_played_free_games=' + showlibraryf2p + '&format=json', function (txt) {
			var data = JSON.parse(txt);
			if (data.response && Object.keys(data.response).length > 0) {
				library_all_games = data.response.games;

				//sort entries
				library_all_games.sort(function(a,b) {
					if ( a.name == b.name ) return 0;
					return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
				});

				var refresh_games_list = function(filter_name) {
					$("#es_library_list").html("");

					var last_app_id_in_games = false;
					var filtered_games = [];

					$.each(library_all_games, function(i, obj) {
						if (obj.name && (filter_name === undefined || new RegExp(filter_name, "i").test(obj.name))) {
							if (obj.name.length > 34) {
								obj.name = obj.name.substring(0,34) + "...";
							}
							var app_html = "<a href='#library/app/" + obj.appid + "' data-appid='" + obj.appid + "' data-playtime-forever='" + obj.playtime_forever + "' class='es_library_app'>";
							if (obj.img_icon_url.length != 0) {
								app_html += "<img src='http://media.steampowered.com/steamcommunity/public/images/apps/" + obj.appid + "/" + obj.img_icon_url + ".jpg' height=16 style='vertical-align: middle;'>&nbsp;";
							}
							$("#es_library_list").append(app_html + obj.name + "</a>");

							if (settings.librarylastappid == obj.appid) {
								last_app_id_in_games = true;
							}

							filtered_games.push(obj);
						}
					});

					if (! last_app_id_in_games && filtered_games.length > 0) {
						settings.librarylastappid = filtered_games[0].appid;
						storage.set({'librarylastappid': settings.librarylastappid});
					}

					$(".es_library_app[data-appid='" + settings.librarylastappid + "']").addClass('es_library_selected');
					$("#es_library_list").data("appid-selected", settings.librarylastappid);
					window.location.hash = "library/app/" + settings.librarylastappid;
				};

				refresh_games_list();

				$("#es_library_search").append("<input type='text' id='es_library_search_input' placeholder='Search'>");
				$("#es_library_search").show();

				$("#es_library_search_input").keyup(function(e) {
					if (e.which != 13) {
						if (! $(this).val()) {
							refresh_games_list();
						}
						else {
							refresh_games_list($(this).val());
						}
					}
				});

				$("#es_library_list_loading").remove();

				deferred.resolve();
			}
			else {
				$("#es_library_list_loading").remove();
				es_library.html("<div id='es_library_private_profile'>" + localized_strings[language].library.private_profile + "</div>");
				deferred.reject();
			}
		});
	});

	return deferred.promise();
}

function library_show_app(appid) {
	$("#es_library_background").removeAttr("style");
	$("#es_library_right").html("<div id='es_library_list_loading'><img src='http://cdn.steamcommunity.com/public/images/login/throbber.gif'>Loading...</div>");

	get_http('http://store.steampowered.com/api/appdetails/?appids=' + appid, function (txt) {
		var app_data = JSON.parse(txt);

		if (app_data[appid].success) {

			// fill background div with screenshot
			var screenshotID = Math.floor(Math.random() * app_data[appid].data.screenshots.length - 1) + 1;
			$('#es_library_background').css('background', 'url(' + app_data[appid].data.screenshots[screenshotID].path_full + ') 0 0 no-repeat');
			$('#es_library_background').css('background-size', 'cover');

			// fill title div with icon and title
			var el_title = $("<div id='es_library_title'></div>");
			$("#es_library_right").append(el_title);
			el_title.append("<img src='" + $(".es_library_app[data-appid='" + appid + "']").children("img").attr("src") + "' height=32>&nbsp;&nbsp;<span style='font-size: 32px; color: #d1d0cc;'>" + app_data[appid].data.name + "</span>");
			
			if (app_data[appid].data.genres && app_data[appid].data.genres.length > 0) {
				var genres = [];
				for (var i = 0; i < app_data[appid].data.genres.length; i++) {
					genres.push(app_data[appid].data.genres[i].description);
				}
				el_title.append("<br><span style='color: grey;'>Genres: " + genres.join(" / ") + "</span>");
			}

			if (app_data[appid].data.categories && app_data[appid].data.categories.length > 0) {
				var categories = [];
				for (var i = 0; i < app_data[appid].data.categories.length; i++) {
					categories.push(app_data[appid].data.categories[i].description);
				}
				el_title.append("<br><span style='color: grey;'>Categories: " + categories.join(" / ") + "</span>");
			}

			// fill "playnow" div
			$("#es_library_right").append("<br><div id='es_library_app_playnow'></div>");
			var el_playnow = $("#es_library_app_playnow");

			el_playnow.append("<a href='steam://run/" + appid + "'><img id='play_button' name='play_button' src='" + chrome.extension.getURL("img/play_off.png") + "'></a>");
			$("#play_button").hover(
				function () { $(this).attr('src', chrome.extension.getURL("img/play_on.png")); }, function () { $(this).attr('src', chrome.extension.getURL("img/play_off.png")); }
			);
			var playtime_forever = $(".es_library_app[data-appid='" + appid + "']").data("playtime-forever");
			if (playtime_forever != "undefined") {
				playtime_forever = parseInt(playtime_forever);
				el_playnow.append("&nbsp;&nbsp;<span style='font-size: 14px; color: #FFF;'>");
				if (playtime_forever < 60) {
					el_playnow.append(playtime_forever + " MINUTES PLAYED");
				} else {
					el_playnow.append(Math.floor(playtime_forever / 60) + " HOURS PLAYED");
				}
				el_playnow.append("</span>");
			}

			var el_hub_link = $("<div id='es_library_hub_link' class='btn_darkblue_white_innerfade'></div>");
			$("#es_library_right").append(el_hub_link);
			el_hub_link.append("<a href='http://steamcommunity.com/app/" + appid + "/'>COMMUNITY HUB</a>");

			$("#es_library_right").append("<br><div id='es_library_app_left'></div><div id='es_library_app_right'></div>");

			// achievements etc. can be loaded later
			$("#es_library_list_loading").remove();

			// fill achievements div

			if (app_data[appid].data.achievements && app_data[appid].data.achievements.total > 0) {
				$("#es_library_app_left").append($("<div class='es_library_app_container' id='es_library_app_achievements_container' style='display: none;'><div id='es_library_app_achievements'></div></div>"));

				// TODO: spam Valve so we can do just 1 request for achievements
				get_http("http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?key=A6509A49A35166921243F4BCC928E812&steamid=" + is_signed_in() + "&appid=" + appid, function(txt) {
					var player_achievements = JSON.parse(txt);

					if (player_achievements.playerstats.achievements) {
						get_http("http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/?key=A6509A49A35166921243F4BCC928E812&steamid=" + is_signed_in() + "&appid=" + appid + "&l=english", function(txt) {
							var achievements_schema = JSON.parse(txt).game.availableGameStats.achievements;
							player_achievements = player_achievements.playerstats.achievements;

							el_achievements_cont = $("#es_library_app_achievements");
							el_achievements_cont.append("<h2>Achievements</h2>");

							var achievements = {};
							var locked_achievements_count = 0;

							for (var i = 0; i < player_achievements.length; i++) {
								achievements[player_achievements[i].apiname] = { achieved: player_achievements[i].achieved };
								if (player_achievements[i].achieved == 0) {
									locked_achievements_count++;
								}
							}

							for (var i = 0; i < achievements_schema.length; i++) {
								$.extend(achievements[achievements_schema[i].name], achievements_schema[i]);
							}

							el_achievements_cont.append("<div style='margin-bottom: 10px;'>You have unlocked " + (player_achievements.length - locked_achievements_count) + "/" + player_achievements.length + " (" + (Math.ceil((player_achievements.length - locked_achievements_count) / player_achievements.length * 100)) + "%)</div>");

							if (locked_achievements_count > 0) {
								el_achievements_cont.append("<div style='margin-bottom: 10px;'>Locked achievements:</div>");

								var shown_locked_achievements_count = 0;

								$.each(achievements, function(key, achievement) {
									if (achievement.achieved == 0) {
										var displayName = (achievement.displayName) ? achievement.displayName.replace(/'/g, "&#39;") + "\n" : "";
										var description = (achievement.description) ? achievement.description.replace(/'/g, "&#39;") : "";
										el_achievements_cont.append("<img src='" + achievement.icongray + "' title='" + displayName + description + "' alt='" + displayName + description + "' class='btn_grey_white_innerfade' style='padding: 4px; margin-right: 10px; width: 32px; height: 32px; cursor: default;'>");
										shown_locked_achievements_count++;
									}

									if (shown_locked_achievements_count == 10) {
										if (locked_achievements_count > shown_locked_achievements_count) {
											el_achievements_cont.append("<a href='http://steamcommunity.com/my/stats/appid/" + appid + "/achievements' class='btn_grey_white_innerfade' style='width: 32px; height: 32px; line-height: 32px; padding: 4px; display: inline-block; vertical-align: top; text-align: center;'>+" + (locked_achievements_count - shown_locked_achievements_count) + "</a>");
										}
										return false;
									}
								});
							}
							else {
								el_achievements_cont.append("You've unlocked every single achievement. Congratulations!");
							}

							el_achievements_cont.append("<div><a href='http://steamcommunity.com/my/stats/appid/" + appid + "/achievements' class='btn_grey_white_innerfade' style='padding: 4px; margin-top: 10px;'>VIEW ALL ACHIEVEMENTS</a></div>");

							$("#es_library_app_achievements_container").show();
						});
					}
				});
			}
			
			// fill news div

			get_http("http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=" + appid + "&maxlength=500&count=3", function(txt) {
				var data = JSON.parse(txt);

				if (data.appnews.newsitems && data.appnews.newsitems.length > 0) {
					$("#es_library_app_left").append($("<div class='es_library_app_container' id='es_library_app_news_container' style='display: none;'><div id='es_library_app_news'></div></div>"));
					el_news_cont = $("#es_library_app_news");
					el_news_cont.append("<h2>News</h2>");

					var news = data.appnews.newsitems;

					for (var i = 0; i < news.length; i++) {
						el_news_cont.append("<div class='es_library_app_news_post'>");
						el_news_cont.append("<h3><a href='" + news[i].url + "'>" + news[i].title  + "</a></h3>");
						el_news_cont.append("<span style='color: grey;'>" + new Date(news[i].date * 1000) + " - " + news[i].feedlabel + "</span>")
						el_news_cont.append("<br>" + news[i].contents);
						el_news_cont.append("<br><a href='" + news[i].url + "' style='text-decoration: underline;'>Read More</a></h3>");
						el_news_cont.append("</div>");
					}

					el_news_cont.append("<div><a href='http://store.steampowered.com/news/?appids=" + appid + "' class='btn_grey_white_innerfade' style='padding: 4px; margin-top: 10px;'>VIEW ALL NEWS</a></div>");

					$("#es_library_app_news_container").show();
				}
			});
			
			// Links in the right sidebar

			$("#es_library_app_right").append($("<div class='es_library_app_container'><div id='es_library_app_links'></div></div>"));
			$("#es_library_app_links").append("<h2>LINKS</h2><ul></ul>");
			if (app_data[appid].data.achievements && app_data[appid].data.achievements.total > 0) {
				$("#es_library_app_links ul").append("<li><a href='http://steamcommunity.com/my/stats/appid/" + appid + "/achievements'>Achievements</a></li>");
			}
			$("#es_library_app_links ul").append("<li><a href='http://store.steampowered.com/app/" + appid + "/'>Store Page</a></li>");
			$("#es_library_app_links ul").append("<li><a href='http://store.steampowered.com/news/?appids=" + appid + "'>News</a></li>");
			$("#es_library_app_links ul").append("<li><a href='http://steamcommunity.com/app/" + appid + "/'>Community Hub</a></li>");
			$("#es_library_app_links ul").append("<li><a href='http://steamcommunity.com/app/" + appid + "/discussions'>Forums</a></li>");
			$("#es_library_app_links ul").append("<li><a href='http://steamcommunity.com/app/" + appid + "/guides'>Community Guides</a></li>");
			$("#es_library_app_links ul").append("<li><a href='http://steamcommunity.com/app/" + appid + "/images'>Artwork</a></li>");
			$("#es_library_app_links ul").append("<li><a href='http://steamcommunity.com/actions/Search?T=ClanAccount&K=" + encodeURIComponent(app_data[appid].data.name) + "'>Related Groups</a></li>");
			$("#es_library_app_links ul").append("<li><a href='http://store.steampowered.com/recommended/recommendgame/" + appid + "'>Recommend</a></li>");
			$("#es_library_app_links ul").append("<li><a href='https://support.steampowered.com/kb_article.php?appid=" + appid + "'>Support</a></li>");
			if (app_data[appid].data.website) {
				$("#es_library_app_links ul").append("<li><a href='" + app_data[appid].data.website + "'>Website</a></li>");
			}
		}
		else {
			$("#es_library_list_loading").html("App ID " + appid + " wasn't found.");
		}
	});
}

// If app has a coupon, display message
function display_coupon_message(appid) {
	// get JSON coupon results

	var coupon_date = getValue(appid + "coupon_valid");
	var coupon_date2 = coupon_date.match(/\[date](.+)\[\/date]/);
	coupon_date2 = Date(coupon_date[1]);
	coupon_date = coupon_date.replace(/\[date](.+)\[\/date]/, coupon_date2);

	var coupon_discount_note = getValue(appid + "coupon_discount_note");
	if (coupon_discount_note === null) { coupon_discount_note = ""; }

	$('#game_area_purchase').before($(""+
	"<div class=\"early_access_header\">" +
	"    <div class=\"heading\">" +
	"        <h1 class=\"inset\">" + localized_strings[language].coupon_available + "</h1>" +
	"        <h2 class=\"inset\">" + localized_strings[language].coupon_application_note + "</h2>" +
	"        <p>" + localized_strings[language].coupon_learn_more + "</p>" +
	"    </div>" +
	"    <div class=\"devnotes\">" +
	"        <table border=0>" +
	"            <tr>" +
	"                <td rowspan=3>" +
	"                    <img src=\"http://cdn.steamcommunity.com/economy/image/" + getValue(appid + "coupon_imageurl") + "\"/>" +
	"                </td>" +
	"                <td valign=center>" +
	"                    <h1>" + getValue(appid + "coupon_title") + "</h1>" +
	"                </td>" +
	"            </tr>" +
	"            <tr>" +
	"                <td>" + coupon_discount_note + "</td>" +
	"            </tr>" +
	"            <tr>" +
	"                <td>" +
	"                    <font style=\"color:#A75124;\">" + coupon_date + "</font>" +
	"                </td>" +
	"            </tr>" +
	"        </table>" +
	"    </div>" +
	"</div>"));

	var $price_div = $("[itemtype=\"http://schema.org/Offer\"]"),
		cart_id = $(document).find("[name=\"subid\"]")[0].value,
		actual_price_container = $price_div.find("[itemprop=\"price\"]")[0].innerText,
		original_price = parseFloat(actual_price_container.match(/([0-9]+(?:(?:\,|\.)[0-9]+)?)/)[1].replace(",", ".")),
		currency_symbol = actual_price_container.match(/(?:R\$|\$|€|£|pуб)/)[0], // Lazy but effective
		comma = (actual_price_container.indexOf(",") > -1);

	var discounted_price = (original_price - (original_price * getValue(appid + "coupon_discount") / 100).toFixed(2)).toFixed(2);

	if (!($price_div.find(".game_purchase_discount").length > 0 && getValue(appid + "coupon_discount_doesnt_stack"))) {
		// If not (existing discounts and coupon does not stack)
		// debugger;

		if (comma) {
			currency_symbol = currency_symbol.replace(".", ",");
			discounted_price = discounted_price.replace(".", ",");
		}

		var original_price_with_symbol,
			discounted_price_with_symbol;

		// Super simple way to put currency symbol on correct end.

		switch (currency_symbol) {
			case "€":
				original_price_with_symbol = original_price + currency_symbol;
				discounted_price_with_symbol = discounted_price + currency_symbol;
				break;

			case "pуб":
				original_price_with_symbol = parseFloat(original_price).toFixed(0) + " " + currency_symbol;
				discounted_price_with_symbol = parseFloat(discounted_price).toFixed(0) + " " + currency_symbol;
				break;

			default:
				original_price_with_symbol = currency_symbol + original_price;
				discounted_price_with_symbol = currency_symbol + discounted_price;
				break;
		}


		$price_div[0].innerHTML = ""+
			"<div class=\"game_purchase_action_bg\">" +
			"    <div class=\"discount_block game_purchase_discount\">" +
			"        <div class=\"discount_pct\">-" + getValue(appid + "coupon_discount") + "%</div>" +
			"        <div class=\"discount_prices\">" +
			"            <div class=\"discount_original_price\">" + original_price_with_symbol + "</div>" +
			"            <div class=\"discount_final_price\" itemprop=\"price\">" + discounted_price_with_symbol + "</div>" +
			"        </div>" +
			"    </div>" +
			"<div class=\"btn_addtocart\">" +
			"    <div class=\"btn_addtocart_left\"></div>" +
			"        <a class=\"btn_addtocart_content\" href=\"javascript:addToCart( " + cart_id + ");\">" + localized_strings[language].add_to_cart + "</a>" +
			"        <div class=\"btn_addtocart_right\"></div>" +
			"    </div>" +
			"</div>";

	}
}

function show_pricing_history(appid, type) {
	storage.get(function(settings) {
		if (settings.showlowestprice === undefined) { settings.showlowestprice = true; storage.set({'showlowestprice': settings.showlowestprice}); }
		if (settings.showlowestprice_region === undefined) { settings.showlowestprice_region = "us"; storage.set({'showlowestprice_region': settings.showlowestprice_region}); }
		if (settings.showallstores === undefined) { settings.showallstores = true; chrome.storage.sync.set({'showallstores': settings.showallstores}); }
		if (settings.stores === undefined) { settings.stores = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true]; chrome.storage.sync.set({'stores': settings.stores}); }
		if (settings.showlowestprice) {

			// Get List of stores we're searching for
			var storestring = "";
			if (settings.stores[0]) { storestring += "steam,"; }
			if (settings.stores[1]) { storestring += "amazonus,"; }
			if (settings.stores[2]) { storestring += "impulse,"; }
			if (settings.stores[3]) { storestring += "gamersgate,"; }
			if (settings.stores[4]) { storestring += "greenmangaming,"; }
			if (settings.stores[5]) { storestring += "gamefly,"; }
			if (settings.stores[6]) { storestring += "origin,"; }
			if (settings.stores[7]) { storestring += "uplay,"; }
			if (settings.stores[8]) { storestring += "indiegalastore,"; }
			if (settings.stores[9]) { storestring += "gametap,"; }
			if (settings.stores[10]) { storestring += "gamesplanet,"; }
			if (settings.stores[11]) { storestring += "getgames,"; }
			if (settings.stores[12]) { storestring += "desura,"; }
			if (settings.stores[13]) { storestring += "gog,"; }
			if (settings.stores[14]) { storestring += "dotemu,"; }
			if (settings.stores[15]) { storestring += "beamdog,"; }
			if (settings.stores[16]) { storestring += "adventureshop,"; }
			if (settings.stores[17]) { storestring += "nuuvem,"; }
			if (settings.stores[18]) { storestring += "shinyloot,"; }
			if (settings.stores[19]) { storestring += "dlgamer,"; }
			if (settings.stores[20]) { storestring += "humblestore,"; }
			if (settings.showallstores) { storestring = "steam,amazonus,impulse,gamersgate,greenmangaming,gamefly,origin,uplay,indiegalastore,gametap,gamesplanet,getgames,desura,gog,dotemu,beamdog,adventureshop,nuuvem,shinyloot,dlgamer,humblestore"; }

			// Get country code from Steam cookie
			var cookies = document.cookie;
			var matched = cookies.match(/fakeCC=([a-z]{2})/i);
			var cc = "us";
			if (matched != null && matched.length == 2) {
				cc = matched[1];
			} else {
				matched = cookies.match(/steamCC(?:_\d+){4}=([a-z]{2})/i);
				if (matched != null && matched.length == 2) {
					cc = matched[1];
				}
			}

			get_http("http://api.enhancedsteam.com/pricev2/?search=" + type + "/" + appid + "&stores=" + storestring + "&cc=" + cc, function (txt) {
                var data = JSON.parse(txt);
                if (data) {
                    var activates = "";
                    var line1 = "";
                    var line2 = "";
                    var recorded,
						currency_symbol,
						comma = false,
						at_end = false;
						
					switch (data[".meta"]["currency"]) {
						case "GBP":
							currency_symbol = "£";
							break;
						case "EUR":
							currency_symbol = "€";
							comma = true;
							at_end = true;
							break;						
						default:
							currency_symbol = "$";
					}
					
                    if (data["lowest"]) {
                        recorded = new Date(data["lowest"]["recorded"]*1000);
                        line2 = localized_strings[language].historical_low + ': ' + formatMoney(escapeHTML(data["lowest"]["price"].toString()), 2, currency_symbol, ",", comma ? "," : ".", at_end) + ' at ' + escapeHTML(data["lowest"]["store"].toString()) + ' on ' + recorded.toDateString() + ' (<a href="' + escapeHTML(data["urls"]["history"].toString()) + '" target="_blank">Info</a>)';
                    }

                    var html = "<div class='game_purchase_area_friends_want' style='padding-top: 5px; height: 35px; border-top: 1px solid #4d4b49; border-left: 1px solid #4d4b49; border-right: 1px solid #4d4b49;' id='enhancedsteam_lowest_price'><div class='gift_icon' style='margin-top: -9px;'><img src='" + chrome.extension.getURL("img/line_chart.png") + "'></div>";

        			if (data["price"]) {
                        if (data["price"]["drm"] == "steam") {
                        	activates = "(<b>Activates on Steam</b>)";
                    		if (data["price"]["store"] == "Steam") {
                    			activates = "";
                    		}
                    	}

                        line1 = localized_strings[language].lowest_price + ': ' + formatMoney(escapeHTML(data["price"]["price"].toString()), 2, currency_symbol, ",", comma ? "," : ".", at_end) + ' at <a href="' + escapeHTML(data["price"]["url"].toString()) + '" target="_blank">' + escapeHTML(data["price"]["store"].toString()) + '</a> ' + activates + ' (<a href="' + escapeHTML(data["urls"]["info"].toString()) + '" target="_blank">Info</a>)';
                        $("#game_area_purchase").before(html + line1 + "<br>" + line2);
                    } else {
                        if (data["lowest"]) {
                            html = "<div class='game_purchase_area_friends_want' style='padding-top: 15px; height: 30px; border-top: 1px solid #4d4b49; border-left: 1px solid #4d4b49; border-right: 1px solid #4d4b49;' id='enhancedsteam_lowest_price'><div class='gift_icon' style='margin-top: -9px;'><img src='" + chrome.extension.getURL("img/line_chart.png") + "'></div>";
                            $("#game_area_purchase").before(html + line2);
                        }
                    }
                }
        	});
		}
	});
}

// Adds red warnings for 3rd party DRM
function drm_warnings() {
	storage.get(function(settings) {
		if (settings.showdrm === undefined) { settings.showdrm = true; storage.set({'showdrm': settings.showdrm}); }
		if (settings.showdrm) {

			var gfwl;
			var uplay;
			var securom;
			var tages;
			var stardock;
			var rockstar;
			var kalypso;
			var otherdrm;

			// Games for Windows Live detection
			if (document.body.innerHTML.indexOf("Games for Windows LIVE") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("Games for Windows Live") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("Games for Windows - Live") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("Games For Windows - Live") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("Games for Windows - LIVE") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("Games For Windows - LIVE") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("Online play requires log-in to Games For Windows") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("INSTALLATION OF THE GAMES FOR WINDOWS LIVE SOFTWARE") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("Multiplayer play and other LIVE features included at no charge") > 0) { gfwl = true; }
			if (document.body.innerHTML.indexOf("www.gamesforwindows.com/live") > 0) { gfwl = true; }

			// Ubisoft Uplay detection
			if (document.body.innerHTML.indexOf("Uplay Account") > 0) { uplay = true; }
			if (document.body.innerHTML.indexOf("UPLAY ACCOUNT") > 0) { uplay = true; }
			if (document.body.innerHTML.indexOf("UPlay account") > 0) { uplay = true; }
			if (document.body.innerHTML.indexOf("HIGH SPEED INTERNET CONNECTION AND CREATION OF A UBISOFT ACCOUNT ARE REQUIRED") > 0) { uplay = true; }
			if (document.body.innerHTML.indexOf("HIGH SPEED INTERNET ACCESS AND CREATION OF A UBISOFT ACCOUNT ARE REQUIRED") > 0) { uplay = true; }
			if (document.body.innerHTML.indexOf("CREATION OF A UBISOFT ACCOUNT") > 0) { uplay = true; }

			// Securom detection
			if (document.body.innerHTML.indexOf("SecuROM") > 0) { securom = true; }
			if (document.body.innerHTML.indexOf("SECUROM") > 0) { securom = true; }

			// Tages detection
			if (document.body.innerHTML.indexOf("Tages") > 0) { tages = true; }
			if (document.body.innerHTML.indexOf("Angebote des Tages") > 0) { tages = false; }
			if (document.body.innerHTML.indexOf("Tagesangebote") > 0) { tages = false; }
			if (document.body.innerHTML.indexOf("TAGES") > 0) { tages = true; }
			if (document.body.innerHTML.indexOf("ANGEBOT DES TAGES") > 0) { tages = false; }
			if (document.body.innerHTML.indexOf("SOLIDSHIELD") > 0) { tages = true; }
			if (document.body.innerHTML.indexOf("Solidshield Tages") > 0) { tages = true; }
			if (document.body.innerHTML.indexOf("Tages Solidshield") > 0) { tages = true; }

			// Stardock account detection
			if (document.body.innerHTML.indexOf("Stardock account") > 0) { stardock = true; }

			// Rockstar social club detection
			if (document.body.innerHTML.indexOf("Rockstar Social Club") > 0) { rockstar = true; }
			if (document.body.innerHTML.indexOf("Rockstar Games Social Club") > 0) { rockstar = true; }

			// Kalypso Launcher detection
			if (document.body.innerHTML.indexOf("Requires a Kalypso account") > 0) { kalypso = true; }

			// Detect other DRM
			if (document.body.innerHTML.indexOf("3rd-party DRM") > 0) { otherdrm = true; }
			if (document.body.innerHTML.indexOf("No 3rd Party DRM") > 0) { otherdrm = false; }

			if (gfwl) {
				$("#game_area_purchase").before('<div class="game_area_already_owned" style="background-image: url( ' + chrome.extension.getURL("img/game_area_warning.png") + ' );">' + localized_strings[language].drm_third_party + ' (Games for Windows Live)</div>');
				otherdrm = false;
			}

			if (uplay) {
				$("#game_area_purchase").before('<div class="game_area_already_owned" style="background-image: url( ' + chrome.extension.getURL("img/game_area_warning.png") + ' );">' + localized_strings[language].drm_third_party + ' (Ubisoft Uplay)</div>');
				otherdrm = false;
			}

			if (securom) {
				$("#game_area_purchase").before('<div class="game_area_already_owned" style="background-image: url( ' + chrome.extension.getURL("img/game_area_warning.png") + ' );">' + localized_strings[language].drm_third_party + ' (SecuROM)</div>');
				otherdrm = false;
			}

			if (tages) {
				$("#game_area_purchase").before('<div class="game_area_already_owned" style="background-image: url( ' + chrome.extension.getURL("img/game_area_warning.png") + ' );">' + localized_strings[language].drm_third_party + ' (Tages)</div>');
				otherdrm = false;
			}

			if (stardock) {
				$("#game_area_purchase").before('<div class="game_area_already_owned" style="background-image: url( ' + chrome.extension.getURL("img/game_area_warning.png") + ' );">' + localized_strings[language].drm_third_party + ' (Stardock Account Required)</div>');
				otherdrm = false;
			}

			if (rockstar) {
				$("#game_area_purchase").before('<div class="game_area_already_owned" style="background-image: url( ' + chrome.extension.getURL("img/game_area_warning.png") + ' );">' + localized_strings[language].drm_third_party + ' (Rockstar Social Club)</div>');
				otherdrm = false;
			}

			if (kalypso) {
				$("#game_area_purchase").before('<div class="game_area_already_owned" style="background-image: url( ' + chrome.extension.getURL("img/game_area_warning.png") + ' );">' + localized_strings[language].drm_third_party + ' (Kalypso Launcher)</div>');
				otherdrm = false;
			}

			if (otherdrm) {
				$("#game_area_purchase").before('<div class="game_area_already_owned" style="background-image: url( ' + chrome.extension.getURL("img/game_area_warning.png") + ' );">' + localized_strings[language].drm_third_party + '</div>');
			}
		}
	});
}

function add_empty_cart_button() {
	addtext = "<a href='javascript:document.cookie=\"shoppingCartGID=0; path=/\";location.reload();' class='btn_checkout_blue' style='float: left; margin-top: 14px;'><div class='leftcap'></div><div class='rightcap'></div>" + localized_strings[language].empty_cart + "</a>";

	var loc = 0;
	xpath_each("//div[contains(@class,'checkout_content')]", function (node) {
		loc = loc + 1;
		if (loc == 2) { $(node).prepend(addtext); }
	});
}

// User profile pages
function add_community_profile_links() {
	if ($("#reportAbuseModal").length > 0) { var steamID = document.getElementsByName("abuseID")[0].value; }

	storage.get(function(settings) {
		if (settings.profile_steamgifts === undefined) { settings.profile_steamgifts = true; chrome.storage.sync.set({'profile_steamgifts': settings.profile_steamgifts}); }
		if (settings.profile_steamtrades === undefined) { settings.profile_steamtrades = true; chrome.storage.sync.set({'profile_steamtrades': settings.profile_steamtrades}); }
		if (settings.profile_steamrep === undefined) { settings.profile_steamrep = true; chrome.storage.sync.set({'profile_steamrep': settings.profile_steamrep}); }
		if (settings.profile_wastedonsteam === undefined) { settings.profile_wastedonsteam = true; chrome.storage.sync.set({'profile_wastedonsteam': settings.profile_wastedonsteam}); }
		if (settings.profile_sapi === undefined) { settings.profile_sapi = true; chrome.storage.sync.set({'profile_sapi': settings.profile_sapi}); }
		if (settings.profile_backpacktf === undefined) { settings.profile_backpacktf = true; chrome.storage.sync.set({'profile_backpacktf': settings.profile_backpacktf}); }
		if (settings.profile_astats === undefined) { settings.profile_astats = true; chrome.storage.sync.set({'profile_astats': settings.profile_astats}); }

		var htmlstr = '';
		if (settings.profile_steamgifts === true) {	htmlstr += '<div class="profile_count_link"><a href="http://www.steamgifts.com/user/id/' + steamID + '" target="_blank"><span class="count_link_label">SteamGifts</span>&nbsp;<img src="' + chrome.extension.getURL('img/ico/steamgifts.ico') + '" width="24" height="24" border="0" /></a></div>'; }
		if (settings.profile_steamtrades === true) { htmlstr += '<div class="profile_count_link"><a href="http://www.steamtrades.com/user/id/' + steamID + '" target="_blank"><span class="count_link_label">SteamTrades</span>&nbsp;<img src="' + chrome.extension.getURL('img/ico/steamtrades.ico') + '" width="24" height="24" border="0" /></a></div>'; }
		if (settings.profile_steamrep === true) { htmlstr += '<div class="profile_count_link"><a href="http://steamrep.com/profiles/' + steamID + '" target="_blank"><span class="count_link_label">SteamRep</span>&nbsp;<img src="' + chrome.extension.getURL('img/ico/steamrep.ico') + '" width="24" height="24" border="0" /></a></div>'; }
		if (settings.profile_wastedonsteam === true) { htmlstr += '<div class="profile_count_link"><a href="http://wastedonsteam.com/id/' + steamID + '" target="_blank"><span class="count_link_label">Wasted On Steam</span>&nbsp;<img src="' + chrome.extension.getURL('img/ico/wastedonsteam.ico') + '" width="24" height="24" border="0" /></a></div>'; }
		if (settings.profile_sapi === true) { htmlstr += '<div class="profile_count_link"><a href="http://sapi.techieanalyst.net/?page=profile&id=' + steamID + '" target="_blank"><span class="count_link_label">sAPI</span>&nbsp;<img src="' + chrome.extension.getURL('img/ico/sapi.ico') + '" width="24" height="24" border="0" /></a></div>'; }
		if (settings.profile_backpacktf === true) { htmlstr += '<div class="profile_count_link"><a href="http://backpack.tf/profiles/' + steamID + '" target="_blank"><span class="count_link_label">backpack.tf</span>&nbsp;<img src="' + chrome.extension.getURL('img/ico/backpacktf.ico') + '" width="24" height="24" border="0" /></a></div>'; }
		if (settings.profile_astats === true) { htmlstr += '<div class="profile_count_link"><a href="http://www.achievementstats.com/index.php?action=profile&playerId=' + steamID + '" target="_blank"><span class="count_link_label">Achievement Stats</span>&nbsp;<img src="' + chrome.extension.getURL('img/ico/achievementstats.ico') + '" width="24" height="24" border="0" /></a></div>'; }

		if (htmlstr != '') { $(".profile_item_links").append(htmlstr); }

	});
}

// Places an "Add to Cart" button on wishlist items
function add_cart_on_wishlist() {
	xpath_each("//a[contains(@class,'btn_visit_store')]", function (node) {
		var app = get_appid(node.href);
		get_http('//store.steampowered.com/api/appdetails/?appids=' + app, function (data) {
			var storefront_data = JSON.parse(data);
			$.each(storefront_data, function(appid, app_data) {
				if (app_data.success) {
					if (app_data.data.packages[0]) {
						var htmlstring = '<form name="add_to_cart_' + app_data.data.packages[0] + '" action="http://store.steampowered.com/cart/" method="POST">';
						htmlstring += '<input type="hidden" name="snr" value="1_5_9__403">';
						htmlstring += '<input type="hidden" name="action" value="add_to_cart">';
						htmlstring += '<input type="hidden" name="subid" value="' + app_data.data.packages[0] + '">';
						htmlstring += '</form>';
						$(node).before('</form>' + htmlstring + '<a href="#" onclick="document.forms[\'add_to_cart_' + app_data.data.packages[0] + '\'].submit();" class="btn_visit_store">' + localized_strings[language].add_to_cart + '</a>  ');
					}
				}
			});
		});
	});
}

// Changes Steam Greenlight pages
function hide_greenlight_banner() {
	// insert the "top bar" found on all other Steam games
	storage.get(function(settings) {
		if (settings.showgreenlightbanner === undefined) { settings.showgreenlightbanner = false; storage.set({'showgreenlightbanner': settings.showgreenlightbanner}); }
		if (settings.showgreenlightbanner) {
			var banner = document.getElementById('ig_top_workshop');
			var html;
			html = '<link href="' + chrome.extension.getURL("css/enhancedsteam.css") + '" rel="stylesheet" type="text/css">';
			html = html + '<div id="store_nav_area"><div class="store_nav_bg"><div class="store_nav">';
			html = html + '<a class="tab " href="http://steamcommunity.com/workshop/browse/?appid=765&section=items"><span>Games</a>';
			html = html + '<a class="tab " href="http://steamcommunity.com/workshop/browse/?appid=765&section=software"><span>Software</a>';
			html = html + '<a class="tab " href="http://steamcommunity.com/workshop/browse/?appid=765&section=concepts"><span>Concepts</a>';
			html = html + '<a class="tab " href="http://steamcommunity.com/workshop/browse/?appid=765&section=collections"><span>Collections</a>';
			html = html + '<a class="tab " href="http://steamcommunity.com/workshop/discussions/?appid=765"><span>Discussions</a>';
			html = html + '<a class="tab " href="http://steamcommunity.com/workshop/about/?appid=765&section=faq"><span>About Greenlight</a>';
			html = html + '<a class="tab " href="http://steamcommunity.com/workshop/news/?appid=765"><span>News</a>';
			$("#ig_top_workshop").before(html);

			// now hide the greenlight banner
			if (banner) { banner.hidden = true;	}
		}
	});
}

function add_metracritic_userscore() {
	// adds metacritic user reviews
	storage.get(function(settings) {
		if (settings.showmcus === undefined) { settings.showmcus = true; storage.set({'showmcus': settings.showmcus}); }
		if (settings.showmcus) {
            var metahtml = document.getElementById("game_area_metascore");
            var metauserscore = 0;
            if (metahtml) {
            	var metalink = document.getElementById("game_area_metalink");
            	meta = metalink.getElementsByTagName("a");
            	for (var i = 0; i < meta.length; i++)
            	var meta_real_link = meta[i].href;
            	get_http("http://api.enhancedsteam.com/metacritic/?mcurl=" + meta_real_link, function (txt) {
            		metauserscore = escapeHTML(txt);
            		metauserscore = metauserscore.replace(".","");
            		var newmeta = '<div id="game_area_metascore" style="background-image: url(' + chrome.extension.getURL("img/metacritic_bg.png") + ');"><div id="metapage">' + escapeHTML(metauserscore) + '</div></div>';
            		$("#game_area_metascore").after(newmeta);
            	});
            }
		}
	});
}

function add_widescreen_certification(appid) {
	storage.get(function(settings) {
		if (settings.showwsgf === undefined) { settings.showwsgf = true; storage.set({'showwsgf': settings.showwsgf}); }
		if (document.body.innerHTML.indexOf("<p>Requires the base game <a href=") <= 0) {
			if (settings.showwsgf) {
				// check to see if game data exists
				get_http("http://api.enhancedsteam.com/wsgf/?appid=" + appid, function (txt) {
					found = 0;
					xpath_each("//div[contains(@class,'game_details')]", function (node) {
						if (found == 0) {
							var data = JSON.parse(txt);
							if (data["node"]) {
								var path = data["node"]["Path"];
								var wsg = data["node"]["WideScreenGrade"];
								var mmg = data["node"]["MultiMonitorGrade"];
								var wsg_icon = "";
								var wsg_text = "";
								var mmg_icon = "";
								var mmg_text = "";

								switch (wsg) {
									case "A":
										wsg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_ws-gold.png";
										wsg_text = "This medal is awarded to games which have received perfect scores from the WSGF for their widescreen support, and are Widescreen Certified.";
										break;
									case "B":
										wsg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_ws-silver.png";
										wsg_text = "This medal is awarded to games that have received a calculated grade of B for their widescreen support.  All of these games are without major flaws, but have at least one blemish that prevents a perfect score.";
										break;
									case "C":
										wsg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_ws-limited.png";
										wsg_text = "This score is awarded to games that have received a calculated grade of C for their widescreen support.  All of these games have some level of widescreen support but have significant issues.";
										break;
									case "Incomplete":
										wsg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_ws-incomplete.png";
										wsg_text = "The default grade for detailed reports.  Usually something is missing which either needs testing and/or verification to be marked as needing grading.";
										break;
									case "Unsupported":
										wsg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_ws-unsupported.png";
										wsg_text = "This score is awarded to games that have no widescreen support.  The game may be unplayable in widescreen, or the image is stretched to fit the window.  Correct aspect ratio is not retained.";
										break;
								}

								switch (mmg) {
									case "A":
										mmg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_mm-gold.png";
										mmg_text = "This medal is awarded to games which have received perfect scores from the WSGF for their multi-monitor support, and are Multi-Monitor Certified.";
										break;
									case "B":
										mmg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_mm-silver.png";
										mmg_text = "This medal is awarded to games that have received a calculated grade of B for their multi-monitor support.  All of these games are without major flaws, but have at least one blemish that prevents a perfect score.";
										break;
									case "C":
										mmg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_mm-limited.png";
										mmg_text = "This score is awarded to games that have received a calculated grade of C for their multi-monitor support.  All of these games have some level of multi-monitor support but have significant issues.";
										break;
									case "Incomplete":
										mmg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_mm-incomplete.png";
										mmg_text = "Incomplete";
										break;
									case "Unsupported":
										mmg_icon = "http://www.enhancedsteam.com/gamedata/icons/wsgf_mm-unsupported.png";
										mmg_text = "This score is awarded to games that have no multi-monitor support.  The game may be unplayable on multiple monitors, or the image is stretched to fit the composite screens.  Correct aspect ratio is not retained.";
										break;
								}

								if (mmg && path && wsg) {
									$(node).after("<div class='block game_details underlined_links'><div class='block_header'><h4>WSGF Widescreen Certifications</h4></div><div class='block_content'><div class='block_content_inner'><div class='details_block'><center><a target='_blank' href='" + escapeHTML(path) + "'><img src='" + escapeHTML(wsg_icon) + "' height='120' title='" + escapeHTML(wsg_text) + "' border=0></a>&nbsp;&nbsp;&nbsp;<a target='_blank' href='" + escapeHTML(path) + "'><img src='" + escapeHTML(mmg_icon) + "' height='120' title='" + escapeHTML(mmg_text) +"' border=0></a><br></center><a class='linkbar' target='_blank' href='" + escapeHTML(path) + "'><div class='rightblock'><img src='http://cdn2.store.steampowered.com/public/images/ico/link_web.gif' width='16' height='16' border='0' align='top'></div>See rating details <img src='http://cdn2.store.steampowered.com/public/images/v5/ico_external_link.gif' border='0' align='bottom'></a></div></div></div></div>");
								}
							}
							found = 1;
						}
					});
				});
			}
		}
	});
}

function add_dlc_page_link(appid) {	
	if ($(".game_area_dlc_section").length > 0) {
		var html = $(".game_area_dlc_section").html();
		title = html.match(/<h2 class=\"gradientbg">(.+)<\/h2>/)[1];
		html = html.replace(title, "<a href='http://store.steampowered.com/dlc/" + appid + "'>" + title + "</a>");		
		$(".game_area_dlc_section").html(html);
	}
}

function fix_wishlist_image_not_found() {
	// fixes "Image not found" in wishlist
	var items = document.getElementById("wishlist_items");
	if (items) {
		imgs = items.getElementsByTagName("img");
		for (var i = 0; i < imgs.length; i++)
		if (imgs[i].src == "http://media.steampowered.com/steamcommunity/public/images/avatars/33/338200c5d6c4d9bdcf6632642a2aeb591fb8a5c2.gif") {
			var gameurl = imgs[i].parentNode.href;
			imgs[i].src = "http://cdn.steampowered.com/v/gfx/apps/" + gameurl.substring(gameurl.lastIndexOf("/") + 1) + "/header.jpg";
		}
	}
}

function account_total_spent() {
	// adds a "total spent on Steam" to the account details page
	storage.get(function(settings) {
		if (settings.showtotal === undefined) { settings.showtotal = true; storage.set({'showtotal': settings.showtotal}); }
		if (settings.showtotal) {
			if ($('.transactionRow').length !== 0) {
				var currency_symbol = $(".accountBalance").html();
				currency_symbol = currency_symbol.match(/(?:R\$|\$|€|£|pуб)/)[0];

				totaler = function (p, i) {
					if (p.innerHTML.indexOf("class=\"transactionRowEvent\">Wallet Credit</div>") < 0) {
						var priceContainer = $(p).find(".transactionRowPrice");
						if (priceContainer.length > 0) {
							var priceText = $(priceContainer).text();
							var regex = /(\d+[.,]\d\d+)/,
								price = regex.exec(priceText);

							if (price !== null && price !== "Total") {
								var tempprice = price[0].toString();
								tempprice = tempprice.replace(",", ".");
								return parseFloat(tempprice);
							}
						}
					}
				};

				game_prices = jQuery.map($('#store_transactions .transactionRow'), totaler);
				ingame_prices = jQuery.map($('#ingame_transactions .transactionRow'), totaler);
				market_prices = jQuery.map($('#market_transactions .transactionRow'), totaler);

				var game_total = 0.0;
				var ingame_total = 0.0;
				var market_total = 0.0;
				jQuery.map(game_prices, function (p, i) { game_total += p; });
				jQuery.map(ingame_prices, function (p, i) { ingame_total += p; });
				jQuery.map(market_prices, function (p, i) { market_total += p; });

				total_total = game_total + ingame_total + market_total;

				if (currency_symbol) {
					switch (currency_symbol) {
						case "€":
							game_total = formatMoney(parseFloat(game_total), 2, currency_symbol, ",", ",", true)
							ingame_total = formatMoney(parseFloat(ingame_total), 2, currency_symbol, ",", ",", true)
							market_total = formatMoney(parseFloat(market_total), 2, currency_symbol, ",", ",", true)
							total_total = formatMoney(parseFloat(total_total), 2, currency_symbol, ",", ",", true)
							break;

						case "pуб":
							currency_symbol = " " + currency_symbol;
							game_total = formatMoney(parseFloat(game_total), 2, currency_symbol, ",", ",", true)
							ingame_total = formatMoney(parseFloat(ingame_total), 2, currency_symbol, ",", ",", true)
							market_total = formatMoney(parseFloat(market_total), 2, currency_symbol, ",", ",", true)
							total_total = formatMoney(parseFloat(total_total), 2, currency_symbol, ",", ",", true)
							break;

						default:
							game_total = formatMoney(parseFloat(game_total), 2, currency_symbol, ",", ".", false)
							ingame_total = formatMoney(parseFloat(ingame_total), 2, currency_symbol, ",", ".", false)
							market_total = formatMoney(parseFloat(market_total), 2, currency_symbol, ",", ".", false)
							total_total = formatMoney(parseFloat(total_total), 2, currency_symbol, ",", ".", false)
							break;
					}

					var html = '<div class="accountRow accountBalance accountSpent">';
					html += '<div class="accountData price">' + game_total + '</div>';
					html += '<div class="accountLabel">' + localized_strings[language].store_transactions + ':</div></div>';
					html += '<div class="accountRow accountBalance accountSpent">';
					html += '<div class="accountData price">' + ingame_total + '</div>';
					html += '<div class="accountLabel">' + localized_strings[language].game_transactions + ':</div></div>';
					html += '<div class="accountRow accountBalance accountSpent">';
					html += '<div class="accountData price">' + market_total + '</div>';
					html += '<div class="accountLabel">' + localized_strings[language].market_transactions + ':</div></div>';
					html += '<div class="inner_rule"></div>';
					html += '<div class="accountRow accountBalance accountSpent">';
					html += '<div class="accountData price">' + total_total + '</div>';
					html += '<div class="accountLabel">' + localized_strings[language].total_spent + ':</div></div>';
					html += '<div class="inner_rule"></div>';

					$('.accountInfoBlock .block_content_inner .accountBalance').before(html);
				}
			}
		}
	});
}

function inventory_market_helper() {
	storage.get(function(settings) {
		if (settings.showinvmarket === undefined) { settings.showinvmarket = false; storage.set({'showinvmarket': settings.showinvmarket}); }
		if (settings.showinvmarket) {
			if ($('#es_item0').length == 0) { $("#iteminfo0_item_market_actions").after("<div class=item_market_actions id=es_item0 height=10></div>"); }
			if ($('#es_item1').length == 0) { $("#iteminfo1_item_market_actions").after("<div class=item_market_actions id=es_item1 height=10></div>"); }
			$('#es_item0').html("");
			$('#es_item1').html("");
			switch (info) {
				case 0:
					info = 1;
					var desc = $('#iteminfo0_item_tags_content')[0].innerHTML;
					var appid = $('#iteminfo0_item_owner_actions')[0].innerHTML;
					appid = appid.match(/steamcommunity.com\/my\/gamecards\/(.+)\/">/)[1];
					if (desc.indexOf("Not Marketable") <= 0) {
						var item_name = $("#iteminfo0_item_name")[0].innerHTML;
						get_http("http://steamcommunity.com/market/listings/753/" + appid + "-" + item_name, function (txt) {
							var item_price = txt.match(/<span class="market_listing_price market_listing_price_with_fee">\r\n(.+)<\/span>/);
							if (item_price) {
								$("#es_item0").html("Lowest sale price: " + item_price[1].trim() + "<br><a href='http://steamcommunity.com/market/listings/753/" + appid + "-" + item_name + "' target='_blank'>Items for sale</a>");
							}
						});
					} else {
						$('#es_item0').remove();
					}
					break;
				case 1:
					info = 0;
					var desc = $('#iteminfo1_item_tags_content')[0].innerHTML;
					var appid = $('#iteminfo1_item_owner_actions')[0].innerHTML;
					appid = appid.match(/steamcommunity.com\/my\/gamecards\/(.+)\/">/)[1];
					if (desc.indexOf("Not Marketable") <= 0) {
						var item_name = $("#iteminfo1_item_name")[0].innerHTML;
						get_http("http://steamcommunity.com/market/listings/753/" + appid + "-" + item_name, function (txt) {
							var item_price = txt.match(/<span class="market_listing_price market_listing_price_with_fee">\r\n(.+)<\/span>/);
							if (item_price) {
								$("#es_item1").html("Lowest sale price: " + item_price[1].trim() + "<br><a href='http://steamcommunity.com/market/listings/753/" + appid + "-" + item_name + "' target='_blank'>Items for sale</a>");
							}
						});
					} else {
						$('#es_item1').remove();
					}
					break;
			}
		}
	});
}

function subscription_savings_check() {
	var not_owned_games_prices = 0,
		appid_info_deferreds = [],
		sub_apps = [],
		sub_app_prices = {},
		comma,
		currency_symbol,
		symbol_right;

	// For each app, load its info.
	$.each($(".tab_row"), function (i, node) {
		var appid = get_appid(node.querySelector("a").href),
			// Remove children, leaving only text (price or only discounted price, if there are discounts)
			price_container = $(node).find(".tab_price").children().remove().end().text().trim();

		if (price_container !== "N/A") {
			if (price_container) {
				if (price_container !== "Free") {
					itemPrice = parseFloat(price_container.match(/([0-9]+(?:(?:\,|\.)[0-9]+)?)/)[1].replace(",", "."));
					if (!currency_symbol) currency_symbol = price_container.match(/(?:R\$|\$|€|£|pуб)/)[0];
				}	

				switch (currency_symbol) {
					case "€":
						symbol_right = true;
						break;
					case "pуб":
						symbol_right = true;
						break;
				}

				if (!comma) comma = (price_container.indexOf(",") > -1);
			} else {
				itemPrice = 0;
			}
		} else {
			itemPrice = 0;
		}

		// Batch app ids, checking for existing promises, then do this.
		ensure_appid_deferred(appid);

		appid_info_deferreds.push(appid_promises[appid].promise);

		sub_apps.push(appid);
		sub_app_prices[appid] = itemPrice;

	});

	// When we have all the app info
	$.when.apply(null, appid_info_deferreds).done(function() {
		for (var i = 0; i < sub_apps.length; i++) {
			if (!getValue(sub_apps[i] + "owned")) not_owned_games_prices += sub_app_prices[sub_apps[i]];
		}
		var $bundle_price = $(".discount_final_price");
		if ($bundle_price.length === 0) $bundle_price = $(".game_purchase_price");

		var bundle_price = Number(($bundle_price[0].innerText).replace(/[^0-9\.]+/g,""));
		if (comma) { not_owned_games_prices = not_owned_games_prices * 100; }
		var corrected_price = not_owned_games_prices - bundle_price;
		
		if (symbol_right) {
			var $message = $('<div class="savings">' + formatMoney((comma ? corrected_price / 100 : corrected_price), 2, currency_symbol, ",", comma ? "," : ".", true) + '</div>');
		} else {
			var $message = $('<div class="savings">' + formatMoney((comma ? corrected_price / 100 : corrected_price), 2, currency_symbol, ",", comma ? "," : ".") + '</div>');
		}
		if (corrected_price < 0) $message[0].style.color = "red";

		$('.savings').replaceWith($message);
	});
}

// pull DLC gamedata from enhancedsteam.com
function dlc_data_from_site(appid) {
    if ($("div.game_area_dlc_bubble").length > 0) {
        var appname = $(".apphub_AppName").html();
		appname = appname.replace("&amp;", "and");
		appname = appname.replace("\"", "");
		appname = appname.replace("“", "");
		get_http("http://api.enhancedsteam.com/gamedata/?appid=" + appid + "&appname=" + appname, function (txt) {
    		var data;
			if (txt != "{\"dlc\":}}") {
				data = JSON.parse(txt);
			}
            var html = "<div class='block'><div class='block_header'><h4>Downloadable Content Details</h4></div><div class='block_content'><div class='block_content_inner'><div class='details_block'>";

            if (data) {
                $.each(data["dlc"], function(index, value) {
                    html += "<div class='game_area_details_specs'><div class='icon'><img src='http://www.enhancedsteam.com/gamedata/icons/" + escapeHTML(value['icon']) + "' align='top'></div><div class='name'><span title='" + escapeHTML(value['text']) + "'>" + escapeHTML(index) + "</span></div></div>";
                });
			}

			html += "</div><a class='linkbar' href='http://www.enhancedsteam.com/gamedata/dlc_category_suggest.php?appid=" + appid + "&appname=" + appname + "' target='_blank'>Suggest a new category</a></div></div></div>";

			$("#demo_block").after(html);
    	});
    }
}

function dlc_data_for_dlc_page() {
	
	var appid_deferred = [];
	var totalunowned = 0;
	var addunowned = "<form name=\"add_all_unowned_dlc_to_cart\" action=\"http://store.steampowered.com/cart/\" method=\"POST\"><input type=\"hidden\" name=\"action\" value=\"add_to_cart\">";
	
	$.each($("div.dlc_page_purchase_dlc"), function(j, node){
		var appid = get_appid(node.href || $(node).find("a")[0].href) || get_appid_wishlist(node.id);
		get_http("http://api.enhancedsteam.com/gamedata/?appid=" + appid, function (txt) {
    		var data;
			if (txt != "{\"dlc\":}}") {
				data = JSON.parse(txt);
			}
            var html = "<div style='width: 250px; margin-left: 310px;'>";

            if (data) {
                $.each(data["dlc"], function(index, value) {
                    html += "<div class='game_area_details_specs'><div class='icon'><img src='http://www.enhancedsteam.com/gamedata/icons/" + escapeHTML(value['icon']) + "' align='top'></div><div class='name'><span title='" + escapeHTML(value['text']) + "'>" + escapeHTML(index) + "</span></div></div>";
                });
			}

			html += "</div>";
			
			$(node).css("height", "144px");
			$(node).append(html);			
    	});
		
		if (appid) {
			if (!getValue(appid + "owned")) {
				get_http('//store.steampowered.com/api/appdetails/?appids=' + appid, function (data) {					
					var storefront_data = JSON.parse(data);					
					$.each(storefront_data, function(application, app_data) {
						if (app_data.success) {
							if (app_data.data.packages[0]) {
								addunowned += "<input type=\"hidden\" name=\"subid[]\" value=\"" + app_data.data.packages[0] + "\">";
								totalunowned = totalunowned + 1;
							}
						}
					});
				});
			}
		}
		
		ensure_appid_deferred(appid);
		appid_deferred.push(appid_promises[appid].promise);		
	});
	
	$.when.apply(null, appid_deferred).done(function() {
		addunowned += "</form>";
		
		if (totalunowned > 0) {
			$("#dlc_purchaseAll").before(addunowned);		
			var buttoncode = "<div class='btn_addtocart' style='float: right; margin-right: 15px;' id='dlc_purchaseAllunOwned'><div class='btn_addtocart_left'></div><div class='btn_addtocart_right'></div><a class='btn_addtocart_content' href=\"javascript:document.forms['add_all_unowned_dlc_to_cart'].submit();\">" + localized_strings[language].add_unowned_dlc_to_cart + "</a></div>";
			$("#dlc_purchaseAll").after(buttoncode);
		}
	});
}

function check_if_purchased() {
	// find the date a game was purchased if owned
	var ownedNode = $(".game_area_already_owned");

	if (ownedNode.length > 0) {
		var appname = $(".apphub_AppName")[0].innerText;
		find_purchase_date(appname);
	}
}

function bind_ajax_content_highlighting() {
	// checks content loaded via AJAX
	var observer = new WebKitMutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			for (var i = 0; i < mutation.addedNodes.length; i++) {
				var node = mutation.addedNodes[i];
				// Check the node is what we want, and not some unrelated DOM change.
				if (node.classList && node.classList.contains("tab_row")) start_highlights_and_tags();
				if (node.classList && node.classList.contains("match")) start_highlights_and_tags();
				if (node.classList && node.classList.contains("market_listing_row_link")) {	highlight_market_items(); }
			}
		});
	});
	observer.observe(document, { subtree: true, childList: true });
	
	$("#search_results").bind("DOMSubtreeModified", start_highlights_and_tags);
	$("#blotter_content").bind("DOMNodeInserted", start_friend_activity_highlights);
	$("#searchResultsRows").bind("DOMNodeInserted", highlight_market_items);
}

function start_highlights_and_tags(){
	/* Batches all the document.ready appid lookups into one storefront call. */

	var selectors = [
		"div.tab_row",			// Storefront rows
		"div.dailydeal",		// Christmas deals; https://www.youtube.com/watch?feature=player_detailpage&v=2gGopKNPqVk#t=52s
		"div.wishlistRow",		// Wishlist row
		"a.game_area_dlc_row",	// DLC on app pages
		"a.small_cap",			// Featured storefront items, and "recommended" section on app pages.
		"a.search_result_row",	// Search result row.
		"a.match",				// Search suggestions row.
		"a.cluster_capsule",	// Carousel items.
		"div.recommendation_highlight",	// Recommendation page.
		"div.recommendation_carousel_item",	// Recommendation page.
		"div.friendplaytime_game",	// Recommendation page.
		"div.dlc_page_purchase_dlc" // DLC page rows
	];

	// Get all appids and nodes from selectors.
	$.each(selectors, function (i, selector) {
		$.each($(selector), function(j, node){
			var appid = get_appid(node.href || $(node).find("a")[0].href) || get_appid_wishlist(node.id);
			if (appid) {
				on_app_info(appid, function(){
					highlight_app(appid, node);
				});
			} else {
				var subid = get_subid(node.href || $(node).find("a")[0].href);
				if (subid) {
					get_sub_details (subid, node);
				}
			}
		});
	});
}

function add_steamdb_links(appid, type) {
	storage.get(function(settings) {
		if (settings.showsteamdb === undefined) { settings.showsteamdb = true; storage.set({'showsteamdb': settings.showsteamdb}); }
		if (settings.showsteamdb) {
			switch (type) {
				case "gamehub":
					$(".apphub_OtherSiteInfo").append('<a href="http://steamdb.info/app/' + appid + '/" class="btn_darkblue_white_innerfade btn_medium" target="_blank"><span>Steam Database</span>');
					break;
				case "gamegroup":
					$('#rightActionBlock' ).append('<div class="actionItemIcon"><img src="' + chrome.extension.getURL("img/steamdb.png") + '" width="16" height="16" alt=""></div><a class="linkActionMinor" target="_blank" href="http://steamdb.info/app/' + appid + '/">' + localized_strings[language].view_in + ' Steam Database</a>');
					break;
				case "app":
					$('#demo_block').find('.block_content_inner').find('.share').before('<div class="demo_area_button"><a class="game_area_wishlist_btn" target="_blank" href="http://steamdb.info/app/' + appid + '/" style="background-image:url(' + chrome.extension.getURL("img/steamdb_store.png") + ')">' + localized_strings[language].view_in + ' Steam Database</a></div>');
					break;
				case "sub":
					$(".share").before('<a class="game_area_wishlist_btn" target="_blank" href="http://steamdb.info/sub/' + appid + '/" style="background-image:url(' + chrome.extension.getURL("img/steamdb_store.png") + ')">' + localized_strings[language].view_in + ' Steam Database</a>');
					break;
			}
		}
	});
}

function get_app_details(appids) {
	// Make sure we have inventory loaded beforehand so we have gift/guestpass/coupon info.
	if (!loading_inventory) loading_inventory = load_inventory();
	loading_inventory.done(function() {

		// Batch request for appids - all untracked or cache-expired apps.
		// Handle new data highlighting as it loads.

		if (!(appids instanceof Array)) appids = [appids];
		get_http('//store.steampowered.com/api/appuserdetails/?appids=' + appids.join(","), function (data) {
			var storefront_data = JSON.parse(data);
			$.each(storefront_data, function(appid, app_data){
				if (app_data.success) {
					setValue(appid + "wishlisted", (app_data.data.added_to_wishlist === true));
					setValue(appid + "owned", (app_data.data.is_owned === true));

					if (app_data.data.friendswant) setValue(appid + "friendswant", app_data.data.friendswant.length);
				}
				// Time updated, for caching.
				setValue(appid, parseInt(Date.now() / 1000, 10));

				// Resolve promise, to run any functions waiting for this apps info.
				appid_promises[appid].resolve();
			});
		});
	});
}

function get_sub_details(subid, node) {
	if (getValue(subid + "owned")) { highlight_owned(node); return; }
	get_http('//store.steampowered.com/api/packagedetails/?packageids=' + subid, function (data) {
		var pack_data = JSON.parse(data);
		$.each(pack_data, function(subid, sub_data) {
			if (sub_data.success) {
				var app_ids = [];
				var owned = [];
				if (sub_data.data.apps) {
					sub_data.data.apps.forEach(function(app) {
						app_ids.push (app.id);
						get_http('//store.steampowered.com/api/appuserdetails/?appids=' + app.id, function (data2) {
							var storefront_data = JSON.parse(data2);
							$.each(storefront_data, function(appid, app_data) {
								if (app_data.success) {
									if (app_data.data.is_owned === true) {
										owned.push(appid);
									}
								}
							});

							if (owned.length == app_ids.length) {
								setValue(subid + "owned", true);
								setValue(subid, parseInt(Date.now() / 1000, 10));
								highlight_app(subid, node);
							}
						});
					});
				}
			}
		});
	});
}

function highlight_app(appid, node) {
	// Order here is important; bottom-most renders last.
	// TODO: Make option

	// Don't highlight "Omg you're on my wishlist!" on users wishlist.
	if (!(node.classList.contains("wishlistRow") || node.classList.contains("wishlistRowItem"))) {
		if (getValue(appid + "wishlisted")) highlight_wishlist(node);
	}

	if (getValue(appid + "owned")) highlight_owned(node);
	if (getValue(appid + "gift")) highlight_inv_gift(node);
	if (getValue(appid + "guestpass")) highlight_inv_guestpass(node);
	if (getValue(appid + "coupon")) highlight_coupon(node);
	if (getValue(appid + "friendswant")) highlight_friends_want(node, appid);
}

function fix_community_hub_links() {
	element = document.querySelector( '.apphub_OtherSiteInfo a' );

	if( element && element.href.charAt( 26 ) === '/' ) {
		element.href = element.href.replace( /\/\/app\//, '/app/' ) + '/';
	}
}

function add_carousel_descriptions() {
	storage.get(function(settings) {
		if (settings.show_carousel_descriptions === undefined) { settings.show_carousel_descriptions = true; storage.set({'show_carousel_descriptions': settings.show_carousel_descriptions}); }
		if (settings.show_carousel_descriptions) {
			// Map appids for batched API lookup
			var capsule_appids = $.map($(".cluster_capsule"), function(obj){return get_appid(obj.href);});

			get_http("//store.steampowered.com/api/appdetails/?appids=" + capsule_appids.join(","), function(txt) {
				// Add description_height_to_add px to the container for carousel items to display adequately.
				var description_height_to_add = 62;  // 60 is good for 4 lines; most strings are 2 or 3 lines than this.
				$(".main_cluster_content").css("height", parseInt($(".main_cluster_content").css("height").replace("px", ""), 10) + description_height_to_add + "px");

				var data = JSON.parse(txt);

				$.each($(".cluster_capsule"), function(i, _obj) {
					var appid = get_appid(_obj.href),
						$desc = $(_obj).find(".main_cap_content"),
						$desc_content = $("<p></p>");

					if (data[appid] !== undefined) {
						if (data[appid].success) {
							// Add description_height_to_add px to each description to display it adequately.
							$desc.css("height", parseInt($desc.css("height").replace("px", ""), 10) + description_height_to_add + "px");
							$desc.parent().css("height", parseInt($desc.parent().css("height").replace("px", ""), 10) + description_height_to_add + "px");

							var raw_string = $(data[appid].data.about_the_game).text();  // jQuery into DOM then get only text; no html pls.

							// Split the string into sentences (we only want the first two).
							// Replace delimiters with themselves and a unique string to split upon, because we want to include the delimiter once split.
							raw_string = raw_string.replace(/([\.\!\?])/g, "$1 Wow_so_unique");
							var string_sentences = raw_string.split("Wow_so_unique"),
								display_string;

							if (string_sentences.length >= 2) {
								display_string = string_sentences[0] + string_sentences[1];
							}
							else {
								// If theres not two sentences, just use the whole thing.
								display_string = raw_string;
							}

							// We're cropping about_the_game to 2 sentences for
							// now; I've asked for game_description_snippet to
							// be added to appdetails API so this may not be
							// necessary in the future.
							$desc_content.html(display_string);

							$desc.append($desc_content);
						}
					} else {
						$desc.css("height", parseInt($desc.css("height").replace("px", ""), 10) + description_height_to_add + "px");
						$desc.parent().css("height", parseInt($desc.parent().css("height").replace("px", ""), 10) + description_height_to_add + "px");
					}
				});
			});
		}
	});
}

function add_small_cap_height() {
	// Add height for another line for tags;
	var height_to_add = 20,
		$small_cap_pager = $(".small_cap_pager"),
		$small_cap = $(".small_cap");

	if ($small_cap.length > 0) {
		if (/^\/$/.test(window.location.pathname)) {
			// $small_cap_pager and $small_cap_page are exclusive to frontpage, so let's not run them anywhere else.
			$.each($small_cap_pager, function(i, obj) {
				// Go though and check if they are one or two row pagers.
				var $obj = $(obj),
					rows = obj.classList.contains("onerow") ? 1 : 2,
					$small_cap_page = $obj.find(".small_cap_page");

				// Don't do anything to the video small_cap
				if (!obj.classList.contains("onerowvideo")) {
					$obj.css("height", parseInt($obj.css("height").replace("px", ""), 10) + (height_to_add * rows) + "px");
					$small_cap_page.css("height", parseInt($small_cap_page.css("height").replace("px", ""), 10) + (height_to_add * rows) + "px");
				}
			});
		}

		$small_cap.css("height", parseInt($small_cap.css("height").replace("px", ""), 10) + height_to_add + "px");
	}
}

function start_friend_activity_highlights() {
	$.each($(".blotter_author_block a"), function (i, node) {
		var appid = get_appid(node.href);
		if (appid && !node.classList.contains("blotter_userstats_game")) {
			$(node).addClass("inline_tags");

			on_app_info(appid, function(){
				highlight_app(appid, node);
			});
		}
	});
}

function highlight_market_items() {
	$.each($(".market_listing_row"), function (i, node) {
		var current_market_name = node.innerHTML.match(/class="market_listing_item_name" style="color: #;">(.+)<\/span>/);
		if (current_market_name) {
			var market_name = getValue("card:" + current_market_name[1]);
			if (market_name) {
				storage.get(function(settings) {
					if (settings.highlight_owned_color === undefined) { settings.highlight_owned_color = "#5c7836";	storage.set({'highlight_owned_color': settings.highlight_owned_color}); }
					if (settings.highlight_owned === undefined) { settings.highlight_owned = true; storage.set({'highlight_owned': settings.highlight_owned}); }
					if (settings.highlight_owned) {
						$(node).css("backgroundImage", "none");
						$(node).css("backgroundColor", settings.highlight_owned_color);
					}
				});
			}
		}
	});
}

function add_app_page_highlights(appid) {
	if (window.location.host == "store.steampowered.com") node = $(".apphub_HeaderStandardTop")[0];
	if (window.location.host == "steamcommunity.com") node = $(".apphub_HeaderTop")[0];

	on_app_info(appid, function(){
		highlight_app(appid, node);
	});
}

function on_app_info(appid, cb) {
	ensure_appid_deferred(appid);

	var expire_time = parseInt(Date.now() / 1000, 10) - 1 * 60 * 60; // One hour ago
	var last_updated = localStorage.getItem(appid) || expire_time - 1;

	// If we have no data on appid, or the data has expired; add it to appids to fetch new data.
	if (last_updated < expire_time) {
		get_app_details(appid);
	}
	else {
		appid_promises[appid].resolve();
	}

	// Bind highlighting.
	appid_promises[appid].promise.done(cb);
}

function add_steamcards_link(appid) {
	if ($(".icon").find('img[src$="/ico_cards.gif"]').length > 0) {
		$('.communitylink').find('div[class$="block_content"]').prepend("<div class='block_content_inner'><a class='linkbar' href='http://steamcommunity.com/my/gamecards/" + appid + "'><div class='rightblock'><img src='" + chrome.extension.getURL("img/ico_cards.gif") + "' width='16' height='16' border='0' align='top' /></div>Steam Trading Cards</a>");
	}
}

function clear_cache() {
	localStorage.clear();
	sessionStorage.clear();
}

function change_user_background() {
	var steamID;
	if ($("#reportAbuseModal").length > 0) { steamID = document.getElementsByName("abuseID")[0].value; }
	get_http("http://api.enhancedsteam.com/profile/?steam64=" + steamID, function (txt) {
		if (txt) {
			$(".no_header")[0].style.backgroundImage = "url(" + escapeHTML(txt) + ")";
			if ($(".profile_background_image_content").length > 0) {
				$(".profile_background_image_content")[0].style.backgroundImage = "url(" + escapeHTML(txt) + ")";
			} else {
				$(".no_header").addClass("has_profile_background");
				$(".profile_content").addClass("has_profile_background");
				$(".profile_content").prepend('<div class="profile_background_holder_content"><div class="profile_background_overlay_content"></div><div class="profile_background_image_content " style="background-image: url(' + escapeHTML(txt) + ');"></div></div></div>');
			}
		}
	});
}

function add_es_background_selection() {
	storage.get(function(settings) {
		if (settings.showesbg === undefined) { settings.showesbg = true; storage.set({'showesbg': settings.showesbg}); }
		if (settings.showesbg) {
			if (window.location.pathname.indexOf("/settings") < 0) {								
				var steam64 = $(document.body).html();
				steam64 = steam64.match(/g_steamID = \"(.+)\";/)[1];				
				var html = "<form id='es_profile_bg' method='POST' action='http://www.enhancedsteam.com/gamedata/profile_bg_save.php'><div class='group_content group_summary'>";
				html += "<input type='hidden' name='steam64' value='" + steam64 + "'>";
				html += "<div class='formRow'><div class='formRowFields'><div class='profile_background_current'><div class='profile_background_current_img_ctn'>";
				html += "<img id='es_profile_background_current_image' src=''>";
				html += "</div><div class='profile_background_current_description'><div id='profile_background_current_name'><select name='es_background' id='es_background' class='gray_bevel dynInput' onchange=\"function image(obj){index=obj.selectedIndex; document.getElementById('es_profile_background_current_image').src=obj.options[index].id; } image(this);\"><option value='0' id='http://www.enhancedsteam.com/gamedata/icons/smallblacksquare.jpg'>None Selected / No Change</option>";

				get_http("http://api.enhancedsteam.com/profile-select/?steam64=" + steam64, function (txt) {
					var data = JSON.parse(txt);

					var array = [];
					for (var key in data["backgrounds"]) {
						if (data["backgrounds"].hasOwnProperty(key)) {
						  array.push(data["backgrounds"][key]);
						}
					}

					array.sort(function(a,b) {
						if ( a.text == b.text ) return 0;
						return a.text < b.text ? -1 : 1;
					});

					$.each(array, function(index, value) {
						if (value["selected"]) {
							html += "<option id='" + escapeHTML(value['id'].toString()) + "' value='" + escapeHTML(value['index'].toString()) + "' SELECTED>" + escapeHTML(value['text'].toString()) + "</option>";
						} else {
							html += "<option id='" + escapeHTML(value['id'].toString()) + "' value='" + escapeHTML(value['index'].toString()) + "'>" + escapeHTML(value['text'].toString()) + "</option>";
						}
					});

					html += "</select></div></div><div style='clear: left;'></div><div class='background_selector_launch_area'></div></div><div class='background_selector_launch_area'>&nbsp;<div style='float: right;'><span class='btn_grey_white_innerfade btn_small' onclick=\"document.getElementById('es_profile_bg').submit()\"><span>" + localized_strings[language].save + "</span></span></div></div><div class='formRowTitle'>" + localized_strings[language].custom_background + ":<span class='formRowHint' title='" + localized_strings[language].custom_background_help + "'>(?)</span></div></div></div>";
					html += "</form>";

					$(".group_content_bodytext").before(html);

					get_http("http://api.enhancedsteam.com/profile-small/?steam64=" + steam64, function (txt) {
						$("#es_profile_background_current_image").attr("src", escapeHTML(txt));
					});
				});
			}
		}
	});
}

function add_feature_search_links () {
	var game_details = ($('.game_area_details_specs').filter(function(){ return !$(this).parents('div').hasClass('icon'); }));
	$.each(game_details, function(index, value) {
		// these will only work with English, until Valve either assigns IDs to these fields or has distinguishable icons
		if (value.innerHTML.match(/MMO/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=20&advanced=0'>"));
		}
		if (value.innerHTML.match(/Local Co-op/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=24&advanced=0'>"));
		}
		if (value.innerHTML.match(/Cross-Platform Multiplayer/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=27&advanced=0'>"));
		}

		// these have somewhat unique icons and should work everywhere
		if (value.innerHTML.match(/ico_multiPlayer/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=1&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_singlePlayer/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=2&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_mod_hl2/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=997&category2=6&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_mod_hl/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=997&category2=7&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_vac/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=8&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_coop/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=9&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_hdr/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=12&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_cc/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=13&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_commentary/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=14&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_stats/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=15&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_sdk/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=16&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_editor/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=17&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_partial_controller/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=18&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_dlc/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=21&category2=21&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_achievements/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=22&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_cloud/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=23&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_leaderboards/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=25&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_guide/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category2=26'>"));
		}
		if (value.innerHTML.match(/ico_controller/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=28&advanced=0'>"));
		}
		if (value.innerHTML.match(/ico_cards/)) {
			var original  = $(this)[0].innerHTML;
			$(this).html(original.replace("<div class=\"name\">", "<div class='name'><a style='text-decoration: none; color: #7cc53f;' href='http://store.steampowered.com/search/?term=&category1=998&category2=29&advanced=0'>"));
		}
	});
}

function totalsize() {
	var html = $("html").html();
	var txt = html.match(/var rgGames = (.+);/);
	var games = JSON.parse(txt[1]);
	var mbt = 0;
	var gbt = 0;
	$.each(games, function(index, value) {
		if (value["client_summary"]) {
			if (/MiB/.test(value["client_summary"]["localContentSize"])) {
				var mb = value["client_summary"]["localContentSize"].match(/(.+) MiB/)
				mbt += parseFloat(mb[1]);
			}
			if (/GiB/.test(value["client_summary"]["localContentSize"])) {
				var gb = value["client_summary"]["localContentSize"].match(/(.+) GiB/)
				gbt += parseFloat(gb[1]);
			}
		}
	});

	mbt = (mbt / 1024);
	var total = (gbt + mbt).toFixed(2);
	$(".clientConnChangingText").before("<p class='clientConnHeaderText'>" + localized_strings[language].total_size + ":</p><p class='clientConnMachineText'>" +total + " GiB</p>");
}


function get_gamecard(t) {
	if (t && t.match(/(?:id|profiles)\/.+\/gamecards\/(\d+)/)) return RegExp.$1;
	else return null;
}

function add_cardexchange_links(game) {
	storage.get(function(settings) {
		if (settings.steamcardexchange === undefined) { settings.steamcardexchange = true; storage.set({'steamcardexchange': settings.steamcardexchange}); }
		if (settings.steamcardexchange) {
			xpath_each("//div[contains(@class,'badge_row')]", function (node) {
				var $node = $(node);
				var gamecard = game || get_gamecard($node.find(".badge_row_overlay").attr('href'));
				if(!gamecard) return;
				$node.prepend('<div style="position: absolute; z-index: 3; top: 12px; right: 12px;"><a href="http://www.steamcardexchange.net/index.php?gamepage-appid-' + gamecard + '" target="_blank" alt="Steam Card Exchange" title="Steam Card Exchange"><img src="' + chrome.extension.getURL('img/ico/steamcardexchange.png') + '" width="24" height="24" border="0" /></a></div>');
				$node.find(".badge_title_row").css("padding-right", "44px");
			});
		}
	});
}

function add_total_drops_count() {
	var drops_count = 0;
	$(".progress_info_bold").each(function(i, obj) {
		var obj_count = obj.innerHTML.match(/\d+/);
		if (obj_count) {
			drops_count += parseInt(obj_count[0]);
		}
	});
	if (drops_count > 0) {
		$(".profile_badges_sortoptions span").prepend(localized_strings[language].card_drops_remaining.replace("__drops__", drops_count) + " ");
	}
}

$(document).ready(function(){
	is_signed_in();

	localization_promise.done(function(){
		// Don't interfere with Storefront API requests
		if (window.location.pathname.startsWith("/api")) return;
		// On window load...
		add_enhanced_steam_options();
		remove_install_steam_button();
		remove_about_menu();
		add_spuf_link();

		// attach event to the logout button
		$('a[href$="http://store.steampowered.com/logout/"]').bind('click', clear_cache);

		switch (window.location.host) {
			case "store.steampowered.com":
				if (is_signed_in()) {
					add_library_menu();
				}

				switch (true) {
					case /^\/cart\/.*/.test(window.location.pathname):
						add_empty_cart_button();
						break;

					case /^\/app\/.*/.test(window.location.pathname):
						var appid = get_appid(window.location.host + window.location.pathname);
						load_inventory().done(function() {
							if (getValue(appid+"coupon")) display_coupon_message(appid);
						});
						show_pricing_history(appid, "app");
						dlc_data_from_site(appid);

						drm_warnings();
						add_metracritic_userscore();
						check_if_purchased();

						fix_community_hub_links();
						add_widescreen_certification(appid);
						add_app_page_highlights(appid);
						add_steamdb_links(appid, "app");
						add_steamcards_link(appid);
						add_feature_search_links();
						add_dlc_page_link(appid);
						break;

					case /^\/sub\/.*/.test(window.location.pathname):
						var subid = get_subid(window.location.host + window.location.pathname);
						drm_warnings();
						subscription_savings_check();
						show_pricing_history(subid, "sub");
						add_steamdb_links(subid, "sub");
						add_feature_search_links();
						break;
						
					case /^\/agecheck\/.*/.test(window.location.pathname):
						send_age_verification();
						break;
						
					case /^\/dlc\/.*/.test(window.location.pathname):
						dlc_data_for_dlc_page();
						break;

					case /^\/account\/.*/.test(window.location.pathname):
						account_total_spent();
						break;

					// Storefront-front only
					case /^\/$/.test(window.location.pathname):
						add_carousel_descriptions();
						break;
				}

				/* Highlights & data fetching */
				start_highlights_and_tags();

				// Storefront homepage tabs.
				bind_ajax_content_highlighting();

				add_small_cap_height();

				break;

			case "steamcommunity.com":

				add_wallet_balance_to_header();


				switch (true) {
					case /^\/(?:id|profiles)\/.+\/wishlist/.test(window.location.pathname):
						add_cart_on_wishlist();
						fix_wishlist_image_not_found();
						add_empty_wishlist_button();

						// wishlist highlights
						start_highlights_and_tags();
						break;

					case /^\/(?:id|profiles)\/.+\/home/.test(window.location.pathname):
						start_friend_activity_highlights();
						bind_ajax_content_highlighting();
						break;

					case /^\/(?:id|profiles)\/.+\/edit/.test(window.location.pathname):
						add_es_background_selection();
						break;

					case /^\/(?:id|profiles)\/[^\/]+\/?$/.test(window.location.pathname):
						add_community_profile_links();
						change_user_background();
						break;

					case /^\/sharedfiles\/.*/.test(window.location.pathname):
						hide_greenlight_banner();
						break;

					case /^\/market\/.*/.test(window.location.pathname):
						load_inventory().done(function() {
							highlight_market_items();
							bind_ajax_content_highlighting();
						});
						break;

					case /^\/id\/.+\/inventory\/?$/.test(window.location.pathname):
						$(".itemHolder").bind("click", function() {
							window.setTimeout(inventory_market_helper,100);
						});
						break;

					case /^\/app\/.*/.test(window.location.pathname):
						var appid = get_appid(window.location.host + window.location.pathname);
						add_app_page_highlights(appid);
						add_steamdb_links(appid, "gamehub");
						break;

					case /^\/games\/.*/.test(window.location.pathname):
						var appid = document.querySelector( 'a[href*="http://steamcommunity.com/app/"]' );
						appid = appid.href.match( /(\d)+/g );
						add_steamdb_links(appid, "gamegroup");
						break;

					case /^\/(?:id|profiles)\/(.+)\/games/.test(window.location.pathname):
						totalsize();
						break;

					case /^\/(?:id|profiles)\/.+\/badges/.test(window.location.pathname):
						add_total_drops_count();
						add_cardexchange_links();
						break;

					case /^\/(?:id|profiles)\/.+\/gamecard/.test(window.location.pathname):
						add_cardexchange_links(get_gamecard(window.location.pathname));
						break;
				}
				break;
		}
	});
});
