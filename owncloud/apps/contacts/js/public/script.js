/**
 * ownCloud - contacts
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Hendrik Leppelsack <hendrik@leppelsack.de>
 * @copyright Hendrik Leppelsack 2015
 */

angular.module('contactsApp', ['uuid4', 'angular-cache', 'ngRoute', 'ui.bootstrap', 'ui.select', 'ngSanitize', 'ngclipboard'])
.config(['$routeProvider', function($routeProvider) {

	$routeProvider.when('/:gid', {
		template: '<contactdetails></contactdetails>'
	});

	$routeProvider.when('/:gid/:uid', {
		template: '<contactdetails></contactdetails>'
	});

	$routeProvider.otherwise('/' + t('contacts', 'All contacts'));

}]);

angular.module('contactsApp')
.directive('datepicker', function() {
	return {
		restrict: 'A',
		require : 'ngModel',
		link : function (scope, element, attrs, ngModelCtrl) {
			$(function() {
				element.datepicker({
					dateFormat:'yy-mm-dd',
					minDate: null,
					maxDate: null,
					onSelect:function (date) {
						ngModelCtrl.$setViewValue(date);
						scope.$apply();
					}
				});
			});
		}
	};
});

angular.module('contactsApp')
.directive('focusExpression', ['$timeout', function ($timeout) {
	return {
		restrict: 'A',
		link: {
			post: function postLink(scope, element, attrs) {
				scope.$watch(attrs.focusExpression, function () {
					if (attrs.focusExpression) {
						if (scope.$eval(attrs.focusExpression)) {
							$timeout(function () {
								if (element.is('input')) {
									element.focus();
								} else {
									element.find('input').focus();
								}
							}, 100); //need some delay to work with ng-disabled
						}
					}
				});
			}
		}
	};
}]);

angular.module('contactsApp')
.directive('inputresize', function() {
	return {
		restrict: 'A',
		link : function (scope, element) {
			var elInput = element.val();
			element.bind('keydown keyup load focus', function() {
				elInput = element.val();
				// If set to 0, the min-width css data is ignored
				var length = elInput.length > 1 ? elInput.length : 1;
				element.attr('size', length);
			});
		}
	};
});

angular.module('contactsApp')
.controller('addressbookCtrl', ['$scope', 'AddressBookService', function($scope, AddressBookService) {
	var ctrl = this;

	ctrl.t = {
		copyUrlTitle : t('contacts', 'Copy Url to clipboard'),
		download: t('contacts', 'Download'),
		showURL:t('contacts', 'ShowURL'),
		shareAddressbook: t('contacts', 'Share Addressbook'),
		deleteAddressbook: t('contacts', 'Delete Addressbook'),
		shareInputPlaceHolder: t('contacts', 'Share with users or groups'),
		delete: t('contacts', 'Delete'),
		canEdit: t('contacts', 'can edit')
	};

	ctrl.showUrl = false;
	/* globals oc_config */
	/* eslint-disable camelcase */
	ctrl.canExport = oc_config.version.split('.') >= [9, 0, 2, 0];
	/* eslint-enable camelcase */

	ctrl.toggleShowUrl = function() {
		ctrl.showUrl = !ctrl.showUrl;
	};

	ctrl.toggleSharesEditor = function() {
		ctrl.editingShares = !ctrl.editingShares;
		ctrl.selectedSharee = null;
	};

	/* From Calendar-Rework - js/app/controllers/calendarlistcontroller.js */
	ctrl.findSharee = function (val) {
		return $.get(
			OC.linkToOCS('apps/files_sharing/api/v1') + 'sharees',
			{
				format: 'json',
				search: val.trim(),
				perPage: 200,
				itemType: 'principals'
			}
		).then(function(result) {
			// Todo - filter out current user, existing sharees
			var users   = result.ocs.data.exact.users.concat(result.ocs.data.users);
			var groups  = result.ocs.data.exact.groups.concat(result.ocs.data.groups);

			var userShares = ctrl.addressBook.sharedWith.users;
			var userSharesLength = userShares.length;
			var i, j;

			// Filter out current user
			var usersLength = users.length;
			for (i = 0 ; i < usersLength; i++) {
				if (users[i].value.shareWith === OC.currentUser) {
					users.splice(i, 1);
					break;
				}
			}

			// Now filter out all sharees that are already shared with
			for (i = 0; i < userSharesLength; i++) {
				var share = userShares[i];
				usersLength = users.length;
				for (j = 0; j < usersLength; j++) {
					if (users[j].value.shareWith === share.id) {
						users.splice(j, 1);
						break;
					}
				}
			}

			// Combine users and groups
			users = users.map(function(item) {
				return {
					display: item.value.shareWith,
					type: OC.Share.SHARE_TYPE_USER,
					identifier: item.value.shareWith
				};
			});

			groups = groups.map(function(item) {
				return {
					display: item.value.shareWith + ' (group)',
					type: OC.Share.SHARE_TYPE_GROUP,
					identifier: item.value.shareWith
				};
			});

			return groups.concat(users);
		});
	};

	ctrl.onSelectSharee = function (item) {
		ctrl.selectedSharee = null;
		AddressBookService.share(ctrl.addressBook, item.type, item.identifier, false, false).then(function() {
			$scope.$apply();
		});

	};

	ctrl.updateExistingUserShare = function(userId, writable) {
		AddressBookService.share(ctrl.addressBook, OC.Share.SHARE_TYPE_USER, userId, writable, true).then(function() {
			$scope.$apply();
		});
	};

	ctrl.updateExistingGroupShare = function(groupId, writable) {
		AddressBookService.share(ctrl.addressBook, OC.Share.SHARE_TYPE_GROUP, groupId, writable, true).then(function() {
			$scope.$apply();
		});
	};

	ctrl.unshareFromUser = function(userId) {
		AddressBookService.unshare(ctrl.addressBook, OC.Share.SHARE_TYPE_USER, userId).then(function() {
			$scope.$apply();
		});
	};

	ctrl.unshareFromGroup = function(groupId) {
		AddressBookService.unshare(ctrl.addressBook, OC.Share.SHARE_TYPE_GROUP, groupId).then(function() {
			$scope.$apply();
		});
	};

	ctrl.deleteAddressBook = function() {
		AddressBookService.delete(ctrl.addressBook).then(function() {
			$scope.$apply();
		});
	};

}]);

angular.module('contactsApp')
.directive('addressbook', function() {
	return {
		restrict: 'A', // has to be an attribute to work with core css
		scope: {
			index: '@'
		},
		controller: 'addressbookCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			addressBook: '=data',
			list: '='
		},
		templateUrl: OC.linkTo('contacts', 'templates/addressBook.html')
	};
});

angular.module('contactsApp')
.controller('addressbooklistCtrl', ['$scope', 'AddressBookService', function($scope, AddressBookService) {
	var ctrl = this;

	ctrl.loading = true;

	AddressBookService.getAll().then(function(addressBooks) {
		ctrl.addressBooks = addressBooks;
		ctrl.loading = false;
	});

	ctrl.t = {
		addressBookName : t('contacts', 'Address book name')
	};

	ctrl.createAddressBook = function() {
		if(ctrl.newAddressBookName) {
			AddressBookService.create(ctrl.newAddressBookName).then(function() {
				AddressBookService.getAddressBook(ctrl.newAddressBookName).then(function(addressBook) {
					ctrl.addressBooks.push(addressBook);
					ctrl.newAddressBookName = '';
					$scope.$apply();
				});
			});
		}
	};
}]);

angular.module('contactsApp')
.directive('addressbooklist', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'addressbooklistCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/addressBookList.html')
	};
});

angular.module('contactsApp')
.controller('avatarCtrl', ['ContactService', function(ContactService) {
	var ctrl = this;

	ctrl.import = ContactService.import.bind(ContactService);

}]);

angular.module('contactsApp')
.directive('avatar', ['ContactService', function(ContactService) {
	return {
		scope: {
			contact: '=data'
		},
		link: function(scope, element) {
			var importText = t('contacts', 'Import');
			scope.importText = importText;

			var input = element.find('input');
			input.bind('change', function() {
				var file = input.get(0).files[0];
				if (file.size > 1024*1024) { // 1 MB
					OC.Notification.showTemporary(t('contacts', 'The selected image is too big (max 1MB)'));
				} else {
					var reader = new FileReader();

					reader.addEventListener('load', function () {
						scope.$apply(function() {
							scope.contact.photo(reader.result);
							ContactService.update(scope.contact);
						});
					}, false);

					if (file) {
						reader.readAsDataURL(file);
					}
				}
			});
		},
		templateUrl: OC.linkTo('contacts', 'templates/avatar.html')
	};
}]);

angular.module('contactsApp')
.controller('contactCtrl', ['$route', '$routeParams', function($route, $routeParams) {
	var ctrl = this;

	ctrl.openContact = function() {
		$route.updateParams({
			gid: $routeParams.gid,
			uid: ctrl.contact.uid()});
	};
}]);

angular.module('contactsApp')
.directive('contact', function() {
	return {
		scope: {},
		controller: 'contactCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			contact: '=data'
		},
		templateUrl: OC.linkTo('contacts', 'templates/contact.html')
	};
});

angular.module('contactsApp')
.controller('contactdetailsCtrl', ['ContactService', 'AddressBookService', 'vCardPropertiesService', '$route', '$routeParams', '$scope', function(ContactService, AddressBookService, vCardPropertiesService, $route, $routeParams, $scope) {

	var ctrl = this;

	ctrl.loading = true;
	ctrl.show = false;

	ctrl.clearContact = function() {
		$route.updateParams({
			gid: $routeParams.gid,
			uid: undefined
		});
		ctrl.show = false;
		ctrl.contact = undefined;
	};

	ctrl.uid = $routeParams.uid;
	ctrl.t = {
		noContacts : t('contacts', 'No contacts in here'),
		placeholderName : t('contacts', 'Name'),
		placeholderOrg : t('contacts', 'Organization'),
		placeholderTitle : t('contacts', 'Title'),
		selectField : t('contacts', 'Add field ...'),
		download : t('contacts', 'Download'),
		delete : t('contacts', 'Delete')
	};

	ctrl.fieldDefinitions = vCardPropertiesService.fieldDefinitions;
	ctrl.focus = undefined;
	ctrl.field = undefined;
	ctrl.addressBooks = [];

	AddressBookService.getAll().then(function(addressBooks) {
		ctrl.addressBooks = addressBooks;

		if (!_.isUndefined(ctrl.contact)) {
			ctrl.addressBook = _.find(ctrl.addressBooks, function(book) {
				return book.displayName === ctrl.contact.addressBookId;
			});
		}
		ctrl.loading = false;
	});

	$scope.$watch('ctrl.uid', function(newValue) {
		ctrl.changeContact(newValue);
	});

	ctrl.changeContact = function(uid) {
		if (typeof uid === 'undefined') {
			ctrl.show = false;
			$('#app-navigation-toggle').removeClass('showdetails');
			return;
		}
		ContactService.getById(uid).then(function(contact) {
			if (angular.isUndefined(contact)) {
				ctrl.clearContact();
				return;
			}
			ctrl.contact = contact;
			ctrl.show = true;
			$('#app-navigation-toggle').addClass('showdetails');

			ctrl.addressBook = _.find(ctrl.addressBooks, function(book) {
				return book.displayName === ctrl.contact.addressBookId;
			});
		});
	};

	ctrl.updateContact = function() {
		ContactService.update(ctrl.contact);
	};

	ctrl.deleteContact = function() {
		ContactService.delete(ctrl.contact);
	};

	ctrl.addField = function(field) {
		var defaultValue = vCardPropertiesService.getMeta(field).defaultValue || {value: ''};
		ctrl.contact.addProperty(field, defaultValue);
		ctrl.focus = field;
		ctrl.field = '';
	};

	ctrl.deleteField = function (field, prop) {
		ctrl.contact.removeProperty(field, prop);
		ctrl.focus = undefined;
	};

	ctrl.changeAddressBook = function (addressBook) {
		ContactService.moveContact(ctrl.contact, addressBook);
	};
}]);

angular.module('contactsApp')
.directive('contactdetails', function() {
	return {
		priority: 1,
		scope: {},
		controller: 'contactdetailsCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/contactDetails.html')
	};
});

angular.module('contactsApp')
.controller('contactimportCtrl', ['ContactService', function(ContactService) {
	var ctrl = this;

	ctrl.import = ContactService.import.bind(ContactService);

}]);

angular.module('contactsApp')
.directive('contactimport', ['ContactService', function(ContactService) {
	return {
		link: function(scope, element) {
			var importText = t('contacts', 'Import');
			scope.importText = importText;

			var input = element.find('input');
			input.bind('change', function() {
				var file = input.get(0).files[0];
				var reader = new FileReader();

				reader.addEventListener('load', function () {
					scope.$apply(function() {
						ContactService.import.call(ContactService, reader.result, file.type, null, function(progress) {
							if(progress===1) {
								scope.importText = importText;
							} else {
								scope.importText = parseInt(Math.floor(progress*100))+'%';
							}
						});
					});
				}, false);

				if (file) {
					reader.readAsText(file);
				}
				input.get(0).value = '';
			});
		},
		templateUrl: OC.linkTo('contacts', 'templates/contactImport.html')
	};
}]);

angular.module('contactsApp')
.controller('contactlistCtrl', ['$scope', '$filter', '$route', '$routeParams', 'ContactService', 'vCardPropertiesService', 'SearchService', function($scope, $filter, $route, $routeParams, ContactService, vCardPropertiesService, SearchService) {
	var ctrl = this;

	ctrl.routeParams = $routeParams;

	ctrl.contactList = [];
	ctrl.searchTerm = '';
	ctrl.show = true;
	ctrl.invalid = false;

	ctrl.t = {
		emptySearch : t('contacts', 'No search result for {query}', {query: ctrl.searchTerm})
	};

	$scope.getCountString = function(contacts) {
		return n('contacts', '%n contact', '%n contacts', contacts.length);
	};

	$scope.query = function(contact) {
		return contact.matches(SearchService.getSearchTerm());
	};

	SearchService.registerObserverCallback(function(ev) {
		if (ev.event === 'submitSearch') {
			var uid = !_.isEmpty(ctrl.contactList) ? ctrl.contactList[0].uid() : undefined;
			ctrl.setSelectedId(uid);
			$scope.$apply();
		}
		if (ev.event === 'changeSearch') {
			ctrl.searchTerm = ev.searchTerm;
			ctrl.t.emptySearch = t('contacts',
								   'No search result for {query}',
								   {query: ctrl.searchTerm}
								  );
			$scope.$apply();
		}
	});

	ctrl.loading = true;

	ContactService.registerObserverCallback(function(ev) {
		$scope.$apply(function() {
			if (ev.event === 'delete') {
				if (ctrl.contactList.length === 1) {
					$route.updateParams({
						gid: $routeParams.gid,
						uid: undefined
					});
				} else {
					for (var i = 0, length = ctrl.contactList.length; i < length; i++) {
						if (ctrl.contactList[i].uid() === ev.uid) {
							$route.updateParams({
								gid: $routeParams.gid,
								uid: (ctrl.contactList[i+1]) ? ctrl.contactList[i+1].uid() : ctrl.contactList[i-1].uid()
							});
							break;
						}
					}
				}
			}
			else if (ev.event === 'create') {
				$route.updateParams({
					gid: $routeParams.gid,
					uid: ev.uid
				});
			}
			ctrl.contacts = ev.contacts;
		});
	});

	// Get contacts
	ContactService.getAll().then(function(contacts) {
		if(contacts.length>0) {
			$scope.$apply(function() {
				ctrl.contacts = contacts;
			});
		} else {
			ctrl.loading = false;
		}
	});

	// Wait for ctrl.contactList to be updated, load the first contact and kill the watch
	var unbindListWatch = $scope.$watch('ctrl.contactList', function() {
		if(ctrl.contactList && ctrl.contactList.length > 0) {
			// Check if a specific uid is requested
			if($routeParams.uid && $routeParams.gid) {
				ctrl.contactList.forEach(function(contact) {
					if(contact.uid() === $routeParams.uid) {
						ctrl.setSelectedId($routeParams.uid);
						ctrl.loading = false;
					}
				});
			}
			// No contact previously loaded, let's load the first of the list if not in mobile mode
			if(ctrl.loading && $(window).width() > 768) {
				ctrl.setSelectedId(ctrl.contactList[0].uid());
			}
			ctrl.loading = false;
			unbindListWatch();
		}
	});

	$scope.$watch('ctrl.routeParams.uid', function(newValue, oldValue) {
		// Used for mobile view to clear the url
		if(typeof oldValue != 'undefined' && typeof newValue == 'undefined' && $(window).width() <= 768) {
			// no contact selected
			ctrl.show = true;
			return;
		}
		if(newValue === undefined) {
			// we might have to wait until ng-repeat filled the contactList
			if(ctrl.contactList && ctrl.contactList.length > 0) {
				$route.updateParams({
					gid: $routeParams.gid,
					uid: ctrl.contactList[0].uid()
				});
			} else {
				// watch for next contactList update
				var unbindWatch = $scope.$watch('ctrl.contactList', function() {
					if(ctrl.contactList && ctrl.contactList.length > 0) {
						$route.updateParams({
							gid: $routeParams.gid,
							uid: ctrl.contactList[0].uid()
						});
					}
					unbindWatch(); // unbind as we only want one update
				});
			}
		} else {
			// displaying contact details
			ctrl.show = false;
		}
	});

	$scope.$watch('ctrl.routeParams.gid', function() {
		// we might have to wait until ng-repeat filled the contactList
		ctrl.contactList = [];
		// not in mobile mode
		if($(window).width() > 768) {
			// watch for next contactList update
			var unbindWatch = $scope.$watch('ctrl.contactList', function() {
				if(ctrl.contactList && ctrl.contactList.length > 0) {
					$route.updateParams({
						gid: $routeParams.gid,
						uid: ctrl.contactList[0].uid()
					});
				}
				unbindWatch(); // unbind as we only want one update
			});
		}
	});

	// Watch if we have an invalid contact
	$scope.$watch('ctrl.contactList[0].displayName()', function(displayName) {
		ctrl.invalid = (displayName === '');
	});

	ctrl.hasContacts = function () {
		if (!ctrl.contacts) {
			return false;
		}
		return ctrl.contacts.length > 0;
	};

	ctrl.setSelectedId = function (contactId) {
		$route.updateParams({
			uid: contactId
		});
	};

	ctrl.getSelectedId = function() {
		return $routeParams.uid;
	};

}]);

angular.module('contactsApp')
.directive('contactlist', function() {
	return {
		priority: 1,
		scope: {},
		controller: 'contactlistCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			addressbook: '=adrbook'
		},
		templateUrl: OC.linkTo('contacts', 'templates/contactList.html')
	};
});

angular.module('contactsApp')
.controller('detailsItemCtrl', ['$templateRequest', 'vCardPropertiesService', 'ContactService', function($templateRequest, vCardPropertiesService, ContactService) {
	var ctrl = this;

	ctrl.meta = vCardPropertiesService.getMeta(ctrl.name);
	ctrl.type = undefined;
	ctrl.isPreferred = false;
	ctrl.t = {
		poBox : t('contacts', 'Post office box'),
		postalCode : t('contacts', 'Postal code'),
		city : t('contacts', 'City'),
		state : t('contacts', 'State or province'),
		country : t('contacts', 'Country'),
		address: t('contacts', 'Address'),
		newGroup: t('contacts', '(new group)'),
		familyName: t('contacts', 'Last name'),
		firstName: t('contacts', 'First name'),
		additionalNames: t('contacts', 'Additional names'),
		honorificPrefix: t('contacts', 'Prefix'),
		honorificSuffix: t('contacts', 'Suffix'),
		delete: t('contacts', 'Delete')
	};

	ctrl.availableOptions = ctrl.meta.options || [];
	if (!_.isUndefined(ctrl.data) && !_.isUndefined(ctrl.data.meta) && !_.isUndefined(ctrl.data.meta.type)) {
		// parse type of the property
		var array = ctrl.data.meta.type[0].split(',');
		array = array.map(function (elem) {
			return elem.trim().replace(/\/+$/, '').replace(/\\+$/, '').trim().toUpperCase();
		});
		// the pref value is handled on its own so that we can add some favorite icon to the ui if we want
		if (array.indexOf('PREF') >= 0) {
			ctrl.isPreferred = true;
			array.splice(array.indexOf('PREF'), 1);
		}
		// simply join the upper cased types together as key
		ctrl.type = array.join(',');
		var displayName = array.map(function (element) {
			return element.charAt(0).toUpperCase() + element.slice(1).toLowerCase();
		}).join(' ');

		// in case the type is not yet in the default list of available options we add it
		if (!ctrl.availableOptions.some(function(e) { return e.id === ctrl.type; } )) {
			ctrl.availableOptions = ctrl.availableOptions.concat([{id: ctrl.type, name: displayName}]);
		}
	}
	if (!_.isUndefined(ctrl.data) && !_.isUndefined(ctrl.data.namespace)) {
		if (!_.isUndefined(ctrl.model.contact.props['X-ABLABEL'])) {
			var val = _.find(this.model.contact.props['X-ABLABEL'], function(x) { return x.namespace === ctrl.data.namespace; });
			ctrl.type = val.value;
			if (!_.isUndefined(val)) {
				// in case the type is not yet in the default list of available options we add it
				if (!ctrl.availableOptions.some(function(e) { return e.id === val.value; } )) {
					ctrl.availableOptions = ctrl.availableOptions.concat([{id: val.value, name: val.value}]);
				}
			}
		}
	}
	ctrl.availableGroups = [];

	ContactService.getGroups().then(function(groups) {
		ctrl.availableGroups = _.unique(groups);
	});

	ctrl.changeType = function (val) {
		if (ctrl.isPreferred) {
			val += ',PREF';
		}
		ctrl.data.meta = ctrl.data.meta || {};
		ctrl.data.meta.type = ctrl.data.meta.type || [];
		ctrl.data.meta.type[0] = val;
		ctrl.model.updateContact();
	};

	ctrl.updateDetailedName = function () {
		var fn = '';
		if (ctrl.data.value[3]) {
			fn += ctrl.data.value[3] + ' ';
		}
		if (ctrl.data.value[1]) {
			fn += ctrl.data.value[1] + ' ';
		}
		if (ctrl.data.value[2]) {
			fn += ctrl.data.value[2] + ' ';
		}
		if (ctrl.data.value[0]) {
			fn += ctrl.data.value[0] + ' ';
		}
		if (ctrl.data.value[4]) {
			fn += ctrl.data.value[4];
		}

		ctrl.model.contact.fullName(fn);
		ctrl.model.updateContact();
	};

	ctrl.getTemplate = function() {
		var templateUrl = OC.linkTo('contacts', 'templates/detailItems/' + ctrl.meta.template + '.html');
		return $templateRequest(templateUrl);
	};

	ctrl.deleteField = function () {
		ctrl.model.deleteField(ctrl.name, ctrl.data);
		ctrl.model.updateContact();
	};
}]);

angular.module('contactsApp')
.directive('detailsitem', ['$compile', function($compile) {
	return {
		scope: {},
		controller: 'detailsItemCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			name: '=',
			data: '=',
			model: '='
		},
		link: function(scope, element, attrs, ctrl) {
			ctrl.getTemplate().then(function(html) {
				var template = angular.element(html);
				element.append(template);
				$compile(template)(scope);
			});
		}
	};
}]);

angular.module('contactsApp')
.controller('groupCtrl', function() {
	// eslint-disable-next-line no-unused-vars
	var ctrl = this;
});

angular.module('contactsApp')
.directive('group', function() {
	return {
		restrict: 'A', // has to be an attribute to work with core css
		scope: {},
		controller: 'groupCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			group: '=data'
		},
		templateUrl: OC.linkTo('contacts', 'templates/group.html')
	};
});

angular.module('contactsApp')
.controller('grouplistCtrl', ['$scope', 'ContactService', 'SearchService', '$routeParams', function($scope, ContactService, SearchService, $routeParams) {
	var ctrl = this;

	var initialGroups = [t('contacts', 'All contacts'), t('contacts', 'Not grouped')];

	ctrl.groups = initialGroups;

	ContactService.getGroups().then(function(groups) {
		ctrl.groups = _.unique(initialGroups.concat(groups));
	});

	ctrl.getSelected = function() {
		return $routeParams.gid;
	};

	// Update groupList on contact add/delete/update
	ContactService.registerObserverCallback(function() {
		$scope.$apply(function() {
			ContactService.getGroups().then(function(groups) {
				ctrl.groups = _.unique(initialGroups.concat(groups));
			});
		});
	});

	ctrl.setSelected = function (selectedGroup) {
		SearchService.cleanSearch();
		$routeParams.gid = selectedGroup;
	};
}]);

angular.module('contactsApp')
.directive('grouplist', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'grouplistCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/groupList.html')
	};
});

angular.module('contactsApp')
.controller('newContactButtonCtrl', ['$scope', 'ContactService', '$routeParams', 'vCardPropertiesService', function($scope, ContactService, $routeParams, vCardPropertiesService) {
	var ctrl = this;

	ctrl.t = {
		addContact : t('contacts', 'New contact')
	};

	ctrl.createContact = function() {
		ContactService.create().then(function(contact) {
			['tel', 'adr', 'email'].forEach(function(field) {
				var defaultValue = vCardPropertiesService.getMeta(field).defaultValue || {value: ''};
				contact.addProperty(field, defaultValue);
			} );
			if ([t('contacts', 'All contacts'), t('contacts', 'Not grouped')].indexOf($routeParams.gid) === -1) {
				contact.categories($routeParams.gid);
			} else {
				contact.categories('');
			}
			$('#details-fullName').focus();
		});
	};
}]);

angular.module('contactsApp')
.directive('newcontactbutton', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'newContactButtonCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/newContactButton.html')
	};
});

angular.module('contactsApp')
.directive('telModel', function() {
	return{
		restrict: 'A',
		require: 'ngModel',
		link: function(scope, element, attr, ngModel) {
			ngModel.$formatters.push(function(value) {
				return value;
			});
			ngModel.$parsers.push(function(value) {
				return value;
			});
		}
	};
});

angular.module('contactsApp')
.factory('AddressBook', function()
{
	return function AddressBook(data) {
		angular.extend(this, {

			displayName: '',
			contacts: [],
			groups: data.data.props.groups,

			getContact: function(uid) {
				for(var i in this.contacts) {
					if(this.contacts[i].uid() === uid) {
						return this.contacts[i];
					}
				}
				return undefined;
			},

			sharedWith: {
				users: [],
				groups: []
			}

		});
		angular.extend(this, data);
		angular.extend(this, {
			owner: data.url.split('/').slice(-3, -2)[0]
		});

		var shares = this.data.props.invite;
		if (typeof shares !== 'undefined') {
			for (var j = 0; j < shares.length; j++) {
				var href = shares[j].href;
				if (href.length === 0) {
					continue;
				}
				var access = shares[j].access;
				if (access.length === 0) {
					continue;
				}

				var readWrite = (typeof access.readWrite !== 'undefined');

				if (href.startsWith('principal:principals/users/')) {
					this.sharedWith.users.push({
						id: href.substr(27),
						displayname: href.substr(27),
						writable: readWrite
					});
				} else if (href.startsWith('principal:principals/groups/')) {
					this.sharedWith.groups.push({
						id: href.substr(28),
						displayname: href.substr(28),
						writable: readWrite
					});
				}
			}
		}

		//var owner = this.data.props.owner;
		//if (typeof owner !== 'undefined' && owner.length !== 0) {
		//	owner = owner.trim();
		//	if (owner.startsWith('/remote.php/dav/principals/users/')) {
		//		this._properties.owner = owner.substr(33);
		//	}
		//}

	};
});

angular.module('contactsApp')
.factory('Contact', ['$filter', function($filter) {
	return function Contact(addressBook, vCard) {
		angular.extend(this, {

			data: {},
			props: {},

			dateProperties: ['bday', 'anniversary', 'deathdate'],

			addressBookId: addressBook.displayName,

			version: function() {
				var property = this.getProperty('version');
				if(property) {
					return property.value;
				}

				return undefined;
			},

			uid: function(value) {
				var model = this;
				if (angular.isDefined(value)) {
					// setter
					return model.setProperty('uid', { value: value });
				} else {
					// getter
					return model.getProperty('uid').value;
				}
			},

			displayName: function() {
				return this.fullName() || this.org() || '';
			},

			fullName: function(value) {
				var model = this;
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('fn', { value: value });
				} else {
					// getter
					var property = model.getProperty('fn');
					if(property) {
						return property.value;
					}
					property = model.getProperty('n');
					if(property) {
						return property.value.filter(function(elem) {
							return elem;
						}).join(' ');
					}
					return undefined;
				}
			},

			title: function(value) {
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('title', { value: value });
				} else {
					// getter
					var property = this.getProperty('title');
					if(property) {
						return property.value;
					} else {
						return undefined;
					}
				}
			},

			org: function(value) {
				var property = this.getProperty('org');
				if (angular.isDefined(value)) {
					var val = value;
					// setter
					if(property && Array.isArray(property.value)) {
						val = property.value;
						val[0] = value;
					}
					return this.setProperty('org', { value: val });
				} else {
					// getter
					if(property) {
						if (Array.isArray(property.value)) {
							return property.value[0];
						}
						return property.value;
					} else {
						return undefined;
					}
				}
			},

			email: function() {
				// getter
				var property = this.getProperty('email');
				if(property) {
					return property.value;
				} else {
					return undefined;
				}
			},

			photo: function(value) {
				if (angular.isDefined(value)) {
					// setter
					// splits image data into "data:image/jpeg" and base 64 encoded image
					var imageData = value.split(';base64,');
					var imageType = imageData[0].slice('data:'.length);
					if (!imageType.startsWith('image/')) {
						return;
					}
					imageType = imageType.substring(6).toUpperCase();

					return this.setProperty('photo', { value: imageData[1], meta: {type: [imageType], encoding: ['b']} });
				} else {
					var property = this.getProperty('photo');
					if(property) {
						var type = property.meta.type;
						if (angular.isArray(type)) {
							type = type[0];
						}
						if (!type.startsWith('image/')) {
							type = 'image/' + type.toLowerCase();
						}
						return 'data:' + type + ';base64,' + property.value;
					} else {
						return undefined;
					}
				}
			},

			categories: function(value) {
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('categories', { value: value });
				} else {
					// getter
					var property = this.getProperty('categories');
					if(!property) {
						return [];
					}
					if (angular.isArray(property.value)) {
						return property.value;
					}
					return [property.value];
				}
			},

			formatDateAsRFC6350: function(name, data) {
				if (_.isUndefined(data) || _.isUndefined(data.value)) {
					return data;
				}
				if (this.dateProperties.indexOf(name) !== -1) {
					var match = data.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
					if (match) {
						data.value = match[1] + match[2] + match[3];
					}
				}

				return data;
			},

			formatDateForDisplay: function(name, data) {
				if (_.isUndefined(data) || _.isUndefined(data.value)) {
					return data;
				}
				if (this.dateProperties.indexOf(name) !== -1) {
					var match = data.value.match(/^(\d{4})(\d{2})(\d{2})$/);
					if (match) {
						data.value = match[1] + '-' + match[2] + '-' + match[3];
					}
				}

				return data;
			},

			getProperty: function(name) {
				if (this.props[name]) {
					return this.formatDateForDisplay(name, this.props[name][0]);
				} else {
					return undefined;
				}
			},
			addProperty: function(name, data) {
				data = angular.copy(data);
				data = this.formatDateAsRFC6350(name, data);
				if(!this.props[name]) {
					this.props[name] = [];
				}
				var idx = this.props[name].length;
				this.props[name][idx] = data;

				// keep vCard in sync
				this.data.addressData = $filter('JSON2vCard')(this.props);
				return idx;
			},
			setProperty: function(name, data) {
				if(!this.props[name]) {
					this.props[name] = [];
				}
				data = this.formatDateAsRFC6350(name, data);
				this.props[name][0] = data;

				// keep vCard in sync
				this.data.addressData = $filter('JSON2vCard')(this.props);
			},
			removeProperty: function (name, prop) {
				angular.copy(_.without(this.props[name], prop), this.props[name]);
				this.data.addressData = $filter('JSON2vCard')(this.props);
			},
			setETag: function(etag) {
				this.data.etag = etag;
			},
			setUrl: function(addressBook, uid) {
				this.data.url = addressBook.url + uid + '.vcf';
			},

			getISODate: function(date) {
				function pad(number) {
					if (number < 10) {
						return '0' + number;
					}
					return '' + number;
				}

				return date.getUTCFullYear() + '' +
						pad(date.getUTCMonth() + 1) +
						pad(date.getUTCDate()) +
						'T' + pad(date.getUTCHours()) +
						pad(date.getUTCMinutes()) +
						pad(date.getUTCSeconds());
			},

			syncVCard: function() {

				this.setProperty('rev', { value: this.getISODate(new Date()) });
				var self = this;

				_.each(this.dateProperties, function(name) {
					if (!_.isUndefined(self.props[name]) && !_.isUndefined(self.props[name][0])) {
						// Set dates again to make sure they are in RFC-6350 format
						self.setProperty(name, self.props[name][0]);
					}
				});
				// force fn to be set
				this.fullName(this.fullName());

				// keep vCard in sync
				self.data.addressData = $filter('JSON2vCard')(self.props);
			},

			matches: function(pattern) {
				if (_.isUndefined(pattern) || pattern.length === 0) {
					return true;
				}
				var model = this;
				var matchingProps = ['fn', 'title', 'org', 'email', 'nickname', 'note', 'url', 'cloud', 'adr', 'impp', 'tel'].filter(function (propName) {
					if (model.props[propName]) {
						return model.props[propName].filter(function (property) {
							if (!property.value) {
								return false;
							}
							if (_.isString(property.value)) {
								return property.value.toLowerCase().indexOf(pattern.toLowerCase()) !== -1;
							}
							if (_.isArray(property.value)) {
								return property.value.filter(function(v) {
									return v.toLowerCase().indexOf(pattern.toLowerCase()) !== -1;
								}).length > 0;
							}
							return false;
						}).length > 0;
					}
					return false;
				});
				return matchingProps.length > 0;
			}

		});

		if(angular.isDefined(vCard)) {
			angular.extend(this.data, vCard);
			angular.extend(this.props, $filter('vCard2JSON')(this.data.addressData));
		} else {
			angular.extend(this.props, {
				version: [{value: '3.0'}],
				fn: [{value: ''}]
			});
			this.data.addressData = $filter('JSON2vCard')(this.props);
		}

		var property = this.getProperty('categories');
		if(!property) {
			this.categories('');
		} else {
			if (angular.isString(property.value)) {
				this.categories([property.value]);
			}
		}
	};
}]);

angular.module('contactsApp')
.factory('AddressBookService', ['DavClient', 'DavService', 'SettingsService', 'AddressBook', '$q', function(DavClient, DavService, SettingsService, AddressBook, $q) {

	var addressBooks = [];
	var loadPromise = undefined;

	var loadAll = function() {
		if (addressBooks.length > 0) {
			return $q.when(addressBooks);
		}
		if (_.isUndefined(loadPromise)) {
			loadPromise = DavService.then(function(account) {
				loadPromise = undefined;
				addressBooks = account.addressBooks.map(function(addressBook) {
					return new AddressBook(addressBook);
				});
			});
		}
		return loadPromise;
	};

	return {
		getAll: function() {
			return loadAll().then(function() {
				return addressBooks;
			});
		},

		getGroups: function () {
			return this.getAll().then(function(addressBooks) {
				return addressBooks.map(function (element) {
					return element.groups;
				}).reduce(function(a, b) {
					return a.concat(b);
				});
			});
		},

		getDefaultAddressBook: function() {
			return addressBooks[0];
		},

		getAddressBook: function(displayName) {
			return DavService.then(function(account) {
				return DavClient.getAddressBook({displayName:displayName, url:account.homeUrl}).then(function(addressBook) {
					addressBook = new AddressBook({
						url: addressBook[0].href,
						data: addressBook[0]
					});
					addressBook.displayName = displayName;
					return addressBook;
				});
			});
		},

		create: function(displayName) {
			return DavService.then(function(account) {
				return DavClient.createAddressBook({displayName:displayName, url:account.homeUrl});
			});
		},

		delete: function(addressBook) {
			return DavService.then(function() {
				return DavClient.deleteAddressBook(addressBook).then(function() {
					var index = addressBooks.indexOf(addressBook);
					addressBooks.splice(index, 1);
				});
			});
		},

		rename: function(addressBook, displayName) {
			return DavService.then(function(account) {
				return DavClient.renameAddressBook(addressBook, {displayName:displayName, url:account.homeUrl});
			});
		},

		get: function(displayName) {
			return this.getAll().then(function(addressBooks) {
				return addressBooks.filter(function (element) {
					return element.displayName === displayName;
				})[0];
			});
		},

		sync: function(addressBook) {
			return DavClient.syncAddressBook(addressBook);
		},

		share: function(addressBook, shareType, shareWith, writable, existingShare) {
			var xmlDoc = document.implementation.createDocument('', '', null);
			var oShare = xmlDoc.createElement('o:share');
			oShare.setAttribute('xmlns:d', 'DAV:');
			oShare.setAttribute('xmlns:o', 'http://owncloud.org/ns');
			xmlDoc.appendChild(oShare);

			var oSet = xmlDoc.createElement('o:set');
			oShare.appendChild(oSet);

			var dHref = xmlDoc.createElement('d:href');
			if (shareType === OC.Share.SHARE_TYPE_USER) {
				dHref.textContent = 'principal:principals/users/';
			} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
				dHref.textContent = 'principal:principals/groups/';
			}
			dHref.textContent += shareWith;
			oSet.appendChild(dHref);

			var oSummary = xmlDoc.createElement('o:summary');
			oSummary.textContent = t('contacts', '{addressbook} shared by {owner}', {
				addressbook: addressBook.displayName,
				owner: addressBook.owner
			});
			oSet.appendChild(oSummary);

			if (writable) {
				var oRW = xmlDoc.createElement('o:read-write');
				oSet.appendChild(oRW);
			}

			var body = oShare.outerHTML;

			return DavClient.xhr.send(
				dav.request.basic({method: 'POST', data: body}),
				addressBook.url
			).then(function(response) {
				if (response.status === 200) {
					if (!existingShare) {
						if (shareType === OC.Share.SHARE_TYPE_USER) {
							addressBook.sharedWith.users.push({
								id: shareWith,
								displayname: shareWith,
								writable: writable
							});
						} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
							addressBook.sharedWith.groups.push({
								id: shareWith,
								displayname: shareWith,
								writable: writable
							});
						}
					}
				}
			});

		},

		unshare: function(addressBook, shareType, shareWith) {
			var xmlDoc = document.implementation.createDocument('', '', null);
			var oShare = xmlDoc.createElement('o:share');
			oShare.setAttribute('xmlns:d', 'DAV:');
			oShare.setAttribute('xmlns:o', 'http://owncloud.org/ns');
			xmlDoc.appendChild(oShare);

			var oRemove = xmlDoc.createElement('o:remove');
			oShare.appendChild(oRemove);

			var dHref = xmlDoc.createElement('d:href');
			if (shareType === OC.Share.SHARE_TYPE_USER) {
				dHref.textContent = 'principal:principals/users/';
			} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
				dHref.textContent = 'principal:principals/groups/';
			}
			dHref.textContent += shareWith;
			oRemove.appendChild(dHref);
			var body = oShare.outerHTML;


			return DavClient.xhr.send(
				dav.request.basic({method: 'POST', data: body}),
				addressBook.url
			).then(function(response) {
				if (response.status === 200) {
					if (shareType === OC.Share.SHARE_TYPE_USER) {
						addressBook.sharedWith.users = addressBook.sharedWith.users.filter(function(user) {
							return user.id !== shareWith;
						});
					} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
						addressBook.sharedWith.groups = addressBook.sharedWith.groups.filter(function(groups) {
							return groups.id !== shareWith;
						});
					}
					//todo - remove entry from addressbook object
					return true;
				} else {
					return false;
				}
			});

		}


	};

}]);

angular.module('contactsApp')
.service('ContactService', ['DavClient', 'AddressBookService', 'Contact', '$q', 'CacheFactory', 'uuid4', function(DavClient, AddressBookService, Contact, $q, CacheFactory, uuid4) {

	var cacheFilled = false;

	var contacts = CacheFactory('contacts');

	var observerCallbacks = [];

	var loadPromise = undefined;

	this.registerObserverCallback = function(callback) {
		observerCallbacks.push(callback);
	};

	var notifyObservers = function(eventName, uid) {
		var ev = {
			event: eventName,
			uid: uid,
			contacts: contacts.values()
		};
		angular.forEach(observerCallbacks, function(callback) {
			callback(ev);
		});
	};

	this.fillCache = function() {
		if (_.isUndefined(loadPromise)) {
			loadPromise = AddressBookService.getAll().then(function (enabledAddressBooks) {
				var promises = [];
				enabledAddressBooks.forEach(function (addressBook) {
					promises.push(
						AddressBookService.sync(addressBook).then(function (addressBook) {
							for (var i in addressBook.objects) {
								if (addressBook.objects[i].addressData) {
									var contact = new Contact(addressBook, addressBook.objects[i]);
									contacts.put(contact.uid(), contact);
								} else {
									// custom console
									console.log('Invalid contact received: ' + addressBook.objects[i].url);
								}
							}
						})
					);
				});
				return $q.all(promises).then(function () {
					cacheFilled = true;
				});
			});
		}
		return loadPromise;
	};

	this.getAll = function() {
		if(cacheFilled === false) {
			return this.fillCache().then(function() {
				return contacts.values();
			});
		} else {
			return $q.when(contacts.values());
		}
	};

	this.getGroups = function () {
		return this.getAll().then(function(contacts) {
			return _.uniq(contacts.map(function (element) {
				return element.categories();
			}).reduce(function(a, b) {
				return a.concat(b);
			}, []).sort(), true);
		});
	};

	this.getById = function(uid) {
		if(cacheFilled === false) {
			return this.fillCache().then(function() {
				return contacts.get(uid);
			});
		} else {
			return $q.when(contacts.get(uid));
		}
	};

	this.create = function(newContact, addressBook, uid) {
		addressBook = addressBook || AddressBookService.getDefaultAddressBook();
		newContact = newContact || new Contact(addressBook);
		var newUid = '';
		if(uuid4.validate(uid)) {
			newUid = uid;
		} else {
			newUid = uuid4.generate();
		}
		newContact.uid(newUid);
		newContact.setUrl(addressBook, newUid);
		newContact.addressBookId = addressBook.displayName;
		if (_.isUndefined(newContact.fullName()) || newContact.fullName() === '') {
			newContact.fullName(t('contacts', 'New contact'));
		}

		return DavClient.createCard(
			addressBook,
			{
				data: newContact.data.addressData,
				filename: newUid + '.vcf'
			}
		).then(function(xhr) {
			newContact.setETag(xhr.getResponseHeader('ETag'));
			contacts.put(newUid, newContact);
			notifyObservers('create', newUid);
			return newContact;
		}).catch(function(xhr) {
			var msg = t('contacts', 'Contact could not be created.');
			if (!angular.isUndefined(xhr) && !angular.isUndefined(xhr.responseXML) && !angular.isUndefined(xhr.responseXML.getElementsByTagNameNS('http://sabredav.org/ns', 'message'))) {
				if ($(xhr.responseXML.getElementsByTagNameNS('http://sabredav.org/ns', 'message')).text()) {
					msg = $(xhr.responseXML.getElementsByTagNameNS('http://sabredav.org/ns', 'message')).text();
				}
			}

			OC.Notification.showTemporary(msg);
		});
	};

	this.import = function(data, type, addressBook, progressCallback) {
		addressBook = addressBook || AddressBookService.getDefaultAddressBook();

		var regexp = /BEGIN:VCARD[\s\S]*?END:VCARD/mgi;
		var singleVCards = data.match(regexp);

		if (!singleVCards) {
			OC.Notification.showTemporary(t('contacts', 'No contacts in file. Only VCard files are allowed.'));
			if (progressCallback) {
				progressCallback(1);
			}
			return;
		}
		var num = 1;
		for(var i in singleVCards) {
			var newContact = new Contact(addressBook, {addressData: singleVCards[i]});
			if (['3.0', '4.0'].indexOf(newContact.version()) < 0) {
				if (progressCallback) {
					progressCallback(num / singleVCards.length);
				}
				OC.Notification.showTemporary(t('contacts', 'Only VCard version 4.0 (RFC6350) or version 3.0 (RFC2426) are supported.'));
				num++;
				continue;
			}
			this.create(newContact, addressBook).then(function() {
				// Update the progress indicator
				if (progressCallback) {
					progressCallback(num / singleVCards.length);
				}
				num++;
			});
		}
	};

	this.moveContact = function (contact, addressbook) {
		if (contact.addressBookId === addressbook.displayName) {
			return;
		}
		contact.syncVCard();
		var clone = angular.copy(contact);
		var uid = contact.uid();

		// delete the old one before to avoid conflict
		this.delete(contact);

		// create the contact in the new target addressbook
		this.create(clone, addressbook, uid);
	};

	this.update = function(contact) {
		// update rev field
		contact.syncVCard();

		// update contact on server
		return DavClient.updateCard(contact.data, {json: true}).then(function(xhr) {
			var newEtag = xhr.getResponseHeader('ETag');
			contact.setETag(newEtag);
			notifyObservers('update', contact.uid());
		});
	};

	this.delete = function(contact) {
		// delete contact from server
		return DavClient.deleteCard(contact.data).then(function() {
			contacts.remove(contact.uid());
			notifyObservers('delete', contact.uid());
		});
	};
}]);

angular.module('contactsApp')
.service('DavClient', function() {
	var xhr = new dav.transport.Basic(
		new dav.Credentials()
	);
	return new dav.Client(xhr);
});

angular.module('contactsApp')
.service('DavService', ['DavClient', function(DavClient) {
	return DavClient.createAccount({
		server: OC.linkToRemote('dav/addressbooks'),
		accountType: 'carddav',
		useProvidedPath: true
	});
}]);

angular.module('contactsApp')
.service('SearchService', function() {
	var searchTerm = '';

	var observerCallbacks = [];

	this.registerObserverCallback = function(callback) {
		observerCallbacks.push(callback);
	};

	var notifyObservers = function(eventName) {
		var ev = {
			event:eventName,
			searchTerm:searchTerm
		};
		angular.forEach(observerCallbacks, function(callback) {
			callback(ev);
		});
	};

	var SearchProxy = {
		attach: function(search) {
			search.setFilter('contacts', this.filterProxy);
		},
		filterProxy: function(query) {
			searchTerm = query;
			notifyObservers('changeSearch');
		}
	};

	this.getSearchTerm = function() {
		return searchTerm;
	};

	this.cleanSearch = function() {
		if (!_.isUndefined($('.searchbox'))) {
			$('.searchbox')[0].reset();
		}
		searchTerm = '';
	};

	if (!_.isUndefined(OC.Plugins)) {
		OC.Plugins.register('OCA.Search', SearchProxy);
		if (!_.isUndefined(OCA.Search)) {
			OC.Search = new OCA.Search($('#searchbox'), $('#searchresults'));
			$('#searchbox').show();
		}
	}

	if (!_.isUndefined($('.searchbox'))) {
		$('.searchbox')[0].addEventListener('keypress', function(e) {
			if(e.keyCode === 13) {
				notifyObservers('submitSearch');
			}
		});
	}
});

angular.module('contactsApp')
.service('SettingsService', function() {
	var settings = {
		addressBooks: [
			'testAddr'
		]
	};

	this.set = function(key, value) {
		settings[key] = value;
	};

	this.get = function(key) {
		return settings[key];
	};

	this.getAll = function() {
		return settings;
	};
});

angular.module('contactsApp')
.service('vCardPropertiesService', function() {
	/**
	 * map vCard attributes to internal attributes
	 *
	 * propName: {
	 * 		multiple: [Boolean], // is this prop allowed more than once? (default = false)
	 * 		readableName: [String], // internationalized readable name of prop
	 * 		template: [String], // template name found in /templates/detailItems
	 * 		[...] // optional additional information which might get used by the template
	 * }
	 */
	this.vCardMeta = {
		nickname: {
			readableName: t('contacts', 'Nickname'),
			template: 'text'
		},
		n: {
			readableName: t('contacts', 'Detailed name'),
			defaultValue: {
				value:['', '', '', '', '']
			},
			template: 'n'
		},
		note: {
			readableName: t('contacts', 'Notes'),
			template: 'textarea'
		},
		url: {
			multiple: true,
			readableName: t('contacts', 'Website'),
			template: 'url'
		},
		cloud: {
			multiple: true,
			readableName: t('contacts', 'Federated Cloud ID'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]		},
		adr: {
			multiple: true,
			readableName: t('contacts', 'Address'),
			template: 'adr',
			defaultValue: {
				value:['', '', '', '', '', '', ''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		categories: {
			readableName: t('contacts', 'Groups'),
			template: 'groups'
		},
		bday: {
			readableName: t('contacts', 'Birthday'),
			template: 'date'
		},
		anniversary: {
			readableName: t('contacts', 'Anniversary'),
			template: 'date'
		},
		deathdate: {
			readableName: t('contacts', 'Date of death'),
			template: 'date'
		},
		email: {
			multiple: true,
			readableName: t('contacts', 'Email'),
			template: 'text',
			defaultValue: {
				value:'',
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		impp: {
			multiple: true,
			readableName: t('contacts', 'Instant messaging'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		tel: {
			multiple: true,
			readableName: t('contacts', 'Phone'),
			template: 'tel',
			defaultValue: {
				value:[''],
				meta:{type:['HOME,VOICE']}
			},
			options: [
				{id: 'HOME,VOICE', name: t('contacts', 'Home')},
				{id: 'WORK,VOICE', name: t('contacts', 'Work')},
				{id: 'CELL', name: t('contacts', 'Mobile')},
				{id: 'FAX', name: t('contacts', 'Fax')},
				{id: 'HOME,FAX', name: t('contacts', 'Fax home')},
				{id: 'WORK,FAX', name: t('contacts', 'Fax work')},
				{id: 'PAGER', name: t('contacts', 'Pager')},
				{id: 'VOICE', name: t('contacts', 'Voice')}
			]
		},
		'X-SOCIALPROFILE': {
			multiple: true,
			readableName: t('contacts', 'Social network'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['facebook']}
			},
			options: [
				{id: 'FACEBOOK', name: 'Facebook'},
				{id: 'TWITTER', name: 'Twitter'}
			]

		}
	};

	this.fieldOrder = [
		'org',
		'title',
		'tel',
		'email',
		'adr',
		'impp',
		'nick',
		'bday',
		'anniversary',
		'deathdate',
		'url',
		'X-SOCIALPROFILE',
		'note',
		'categories',
		'role'
	];

	this.fieldDefinitions = [];
	for (var prop in this.vCardMeta) {
		this.fieldDefinitions.push({id: prop, name: this.vCardMeta[prop].readableName, multiple: !!this.vCardMeta[prop].multiple});
	}

	this.fallbackMeta = function(property) {
		function capitalize(string) { return string.charAt(0).toUpperCase() + string.slice(1); }
		return {
			name: 'unknown-' + property,
			readableName: capitalize(property),
			template: 'hidden',
			necessity: 'optional'
		};
	};

	this.getMeta = function(property) {
		return this.vCardMeta[property] || this.fallbackMeta(property);
	};

});

angular.module('contactsApp')
.filter('JSON2vCard', function() {
	return function(input) {
		return vCard.generate(input);
	};
});

angular.module('contactsApp')
.filter('contactColor', function() {
	return function(input) {
		// Check if core has the new color generator
		if(typeof input.toHsl === 'function') {
			var hsl = input.toHsl();
			return 'hsl('+hsl[0]+', '+hsl[1]+'%, '+hsl[2]+'%)';
		} else {
			// If not, we use the old one
			/* global md5 */
			var hash = md5(input).substring(0, 4),
				maxRange = parseInt('ffff', 16),
				hue = parseInt(hash, 16) / maxRange * 256;
			return 'hsl(' + hue + ', 90%, 65%)';
		}
	};
});
angular.module('contactsApp')
.filter('contactGroupFilter', function() {
	'use strict';
	return function (contacts, group) {
		if (typeof contacts === 'undefined') {
			return contacts;
		}
		if (typeof group === 'undefined' || group.toLowerCase() === t('contacts', 'All contacts').toLowerCase()) {
			return contacts;
		}
		var filter = [];
		if (contacts.length > 0) {
			for (var i = 0; i < contacts.length; i++) {
				if (group.toLowerCase() === t('contacts', 'Not grouped').toLowerCase()) {
					if (contacts[i].categories().length === 0) {
						filter.push(contacts[i]);
					}
				} else {
					if (contacts[i].categories().indexOf(group) >= 0) {
						filter.push(contacts[i]);
					}
				}
			}
		}
		return filter;
	};
});

angular.module('contactsApp')
.filter('fieldFilter', function() {
	'use strict';
	return function (fields, contact) {
		if (typeof fields === 'undefined') {
			return fields;
		}
		if (typeof contact === 'undefined') {
			return fields;
		}
		var filter = [];
		if (fields.length > 0) {
			for (var i = 0; i < fields.length; i++) {
				if (fields[i].multiple ) {
					filter.push(fields[i]);
					continue;
				}
				if (_.isUndefined(contact.getProperty(fields[i].id))) {
					filter.push(fields[i]);
				}
			}
		}
		return filter;
	};
});

angular.module('contactsApp')
.filter('firstCharacter', function() {
	return function(input) {
		return input.charAt(0);
	};
});

angular.module('contactsApp')
.filter('localeOrderBy', [function () {
	return function (array, sortPredicate, reverseOrder) {
		if (!Array.isArray(array)) return array;
		if (!sortPredicate) return array;

		var arrayCopy = [];
		angular.forEach(array, function (item) {
			arrayCopy.push(item);
		});

		arrayCopy.sort(function (a, b) {
			var valueA = a[sortPredicate];
			if (angular.isFunction(valueA)) {
				valueA = a[sortPredicate]();
			}
			var valueB = b[sortPredicate];
			if (angular.isFunction(valueB)) {
				valueB = b[sortPredicate]();
			}

			if (angular.isString(valueA)) {
				return !reverseOrder ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
			}

			if (angular.isNumber(valueA) || angular.isBoolean(valueA)) {
				return !reverseOrder ? valueA - valueB : valueB - valueA;
			}

			return 0;
		});

		return arrayCopy;
	};
}]);


angular.module('contactsApp')
.filter('newContact', function() {
	return function(input) {
		return input !== '' ? input : t('contacts', 'New contact');
	};
});

angular.module('contactsApp')
.filter('orderDetailItems', ['vCardPropertiesService', function(vCardPropertiesService) {
	'use strict';
	return function(items, field, reverse) {

		var filtered = [];
		angular.forEach(items, function(item) {
			filtered.push(item);
		});

		var fieldOrder = angular.copy(vCardPropertiesService.fieldOrder);
		// reverse to move custom items to the end (indexOf == -1)
		fieldOrder.reverse();

		filtered.sort(function (a, b) {
			if(fieldOrder.indexOf(a[field]) < fieldOrder.indexOf(b[field])) {
				return 1;
			}
			if(fieldOrder.indexOf(a[field]) > fieldOrder.indexOf(b[field])) {
				return -1;
			}
			return 0;
		});

		if(reverse) filtered.reverse();
		return filtered;
	};
}]);

angular.module('contactsApp')
.filter('toArray', function() {
	return function(obj) {
		if (!(obj instanceof Object)) return obj;
		return _.map(obj, function(val, key) {
			return Object.defineProperty(val, '$key', {value: key});
		});
	};
});

angular.module('contactsApp')
.filter('vCard2JSON', function() {
	return function(input) {
		return vCard.parse(input);
	};
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCJkYXRlcGlja2VyX2RpcmVjdGl2ZS5qcyIsImZvY3VzX2RpcmVjdGl2ZS5qcyIsImlucHV0cmVzaXplX2RpcmVjdGl2ZS5qcyIsImFkZHJlc3NCb29rL2FkZHJlc3NCb29rX2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9vay9hZGRyZXNzQm9va19kaXJlY3RpdmUuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2RpcmVjdGl2ZS5qcyIsImF2YXRhci9hdmF0YXJfY29udHJvbGxlci5qcyIsImF2YXRhci9hdmF0YXJfZGlyZWN0aXZlLmpzIiwiY29udGFjdC9jb250YWN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0L2NvbnRhY3RfZGlyZWN0aXZlLmpzIiwiY29udGFjdERldGFpbHMvY29udGFjdERldGFpbHNfY29udHJvbGxlci5qcyIsImNvbnRhY3REZXRhaWxzL2NvbnRhY3REZXRhaWxzX2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RJbXBvcnQvY29udGFjdEltcG9ydF9jb250cm9sbGVyLmpzIiwiY29udGFjdEltcG9ydC9jb250YWN0SW1wb3J0X2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RMaXN0L2NvbnRhY3RMaXN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0TGlzdC9jb250YWN0TGlzdF9kaXJlY3RpdmUuanMiLCJkZXRhaWxzSXRlbS9kZXRhaWxzSXRlbV9jb250cm9sbGVyLmpzIiwiZGV0YWlsc0l0ZW0vZGV0YWlsc0l0ZW1fZGlyZWN0aXZlLmpzIiwiZ3JvdXAvZ3JvdXBfY29udHJvbGxlci5qcyIsImdyb3VwL2dyb3VwX2RpcmVjdGl2ZS5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfY29udHJvbGxlci5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfZGlyZWN0aXZlLmpzIiwibmV3Q29udGFjdEJ1dHRvbi9uZXdDb250YWN0QnV0dG9uX2NvbnRyb2xsZXIuanMiLCJuZXdDb250YWN0QnV0dG9uL25ld0NvbnRhY3RCdXR0b25fZGlyZWN0aXZlLmpzIiwicGFyc2Vycy90ZWxNb2RlbF9kaXJlY3RpdmUuanMiLCJhZGRyZXNzQm9va19tb2RlbC5qcyIsImNvbnRhY3RfbW9kZWwuanMiLCJhZGRyZXNzQm9va19zZXJ2aWNlLmpzIiwiY29udGFjdF9zZXJ2aWNlLmpzIiwiZGF2Q2xpZW50X3NlcnZpY2UuanMiLCJkYXZfc2VydmljZS5qcyIsInNlYXJjaF9zZXJ2aWNlLmpzIiwic2V0dGluZ3Nfc2VydmljZS5qcyIsInZDYXJkUHJvcGVydGllcy5qcyIsIkpTT04ydkNhcmRfZmlsdGVyLmpzIiwiY29udGFjdENvbG9yX2ZpbHRlci5qcyIsImNvbnRhY3RHcm91cF9maWx0ZXIuanMiLCJmaWVsZF9maWx0ZXIuanMiLCJmaXJzdENoYXJhY3Rlcl9maWx0ZXIuanMiLCJsb2NhbGVPcmRlckJ5X2ZpbHRlci5qcyIsIm5ld0NvbnRhY3RfZmlsdGVyLmpzIiwib3JkZXJEZXRhaWxJdGVtc19maWx0ZXIuanMiLCJ0b0FycmF5X2ZpbHRlci5qcyIsInZDYXJkMkpTT05fZmlsdGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7O0FBVUEsUUFBUSxPQUFPLGVBQWUsQ0FBQyxTQUFTLGlCQUFpQixXQUFXLGdCQUFnQixhQUFhLGNBQWM7Q0FDOUcsMEJBQU8sU0FBUyxnQkFBZ0I7O0NBRWhDLGVBQWUsS0FBSyxTQUFTO0VBQzVCLFVBQVU7OztDQUdYLGVBQWUsS0FBSyxjQUFjO0VBQ2pDLFVBQVU7OztDQUdYLGVBQWUsVUFBVSxNQUFNLEVBQUUsWUFBWTs7O0FBRzlDO0FDeEJBLFFBQVEsT0FBTztDQUNkLFVBQVUsY0FBYyxXQUFXO0NBQ25DLE9BQU87RUFDTixVQUFVO0VBQ1YsVUFBVTtFQUNWLE9BQU8sVUFBVSxPQUFPLFNBQVMsT0FBTyxhQUFhO0dBQ3BELEVBQUUsV0FBVztJQUNaLFFBQVEsV0FBVztLQUNsQixXQUFXO0tBQ1gsU0FBUztLQUNULFNBQVM7S0FDVCxTQUFTLFVBQVUsTUFBTTtNQUN4QixZQUFZLGNBQWM7TUFDMUIsTUFBTTs7Ozs7OztBQU9aO0FDcEJBLFFBQVEsT0FBTztDQUNkLFVBQVUsZ0NBQW1CLFVBQVUsVUFBVTtDQUNqRCxPQUFPO0VBQ04sVUFBVTtFQUNWLE1BQU07R0FDTCxNQUFNLFNBQVMsU0FBUyxPQUFPLFNBQVMsT0FBTztJQUM5QyxNQUFNLE9BQU8sTUFBTSxpQkFBaUIsWUFBWTtLQUMvQyxJQUFJLE1BQU0saUJBQWlCO01BQzFCLElBQUksTUFBTSxNQUFNLE1BQU0sa0JBQWtCO09BQ3ZDLFNBQVMsWUFBWTtRQUNwQixJQUFJLFFBQVEsR0FBRyxVQUFVO1NBQ3hCLFFBQVE7ZUFDRjtTQUNOLFFBQVEsS0FBSyxTQUFTOztVQUVyQjs7Ozs7Ozs7QUFRVjtBQ3ZCQSxRQUFRLE9BQU87Q0FDZCxVQUFVLGVBQWUsV0FBVztDQUNwQyxPQUFPO0VBQ04sVUFBVTtFQUNWLE9BQU8sVUFBVSxPQUFPLFNBQVM7R0FDaEMsSUFBSSxVQUFVLFFBQVE7R0FDdEIsUUFBUSxLQUFLLDRCQUE0QixXQUFXO0lBQ25ELFVBQVUsUUFBUTs7SUFFbEIsSUFBSSxTQUFTLFFBQVEsU0FBUyxJQUFJLFFBQVEsU0FBUztJQUNuRCxRQUFRLEtBQUssUUFBUTs7Ozs7QUFLekI7QUNmQSxRQUFRLE9BQU87Q0FDZCxXQUFXLG9EQUFtQixTQUFTLFFBQVEsb0JBQW9CO0NBQ25FLElBQUksT0FBTzs7Q0FFWCxLQUFLLElBQUk7RUFDUixlQUFlLEVBQUUsWUFBWTtFQUM3QixVQUFVLEVBQUUsWUFBWTtFQUN4QixRQUFRLEVBQUUsWUFBWTtFQUN0QixrQkFBa0IsRUFBRSxZQUFZO0VBQ2hDLG1CQUFtQixFQUFFLFlBQVk7RUFDakMsdUJBQXVCLEVBQUUsWUFBWTtFQUNyQyxRQUFRLEVBQUUsWUFBWTtFQUN0QixTQUFTLEVBQUUsWUFBWTs7O0NBR3hCLEtBQUssVUFBVTs7O0NBR2YsS0FBSyxZQUFZLFVBQVUsUUFBUSxNQUFNLFFBQVEsQ0FBQyxHQUFHLEdBQUcsR0FBRzs7O0NBRzNELEtBQUssZ0JBQWdCLFdBQVc7RUFDL0IsS0FBSyxVQUFVLENBQUMsS0FBSzs7O0NBR3RCLEtBQUsscUJBQXFCLFdBQVc7RUFDcEMsS0FBSyxnQkFBZ0IsQ0FBQyxLQUFLO0VBQzNCLEtBQUssaUJBQWlCOzs7O0NBSXZCLEtBQUssYUFBYSxVQUFVLEtBQUs7RUFDaEMsT0FBTyxFQUFFO0dBQ1IsR0FBRyxVQUFVLCtCQUErQjtHQUM1QztJQUNDLFFBQVE7SUFDUixRQUFRLElBQUk7SUFDWixTQUFTO0lBQ1QsVUFBVTs7SUFFVixLQUFLLFNBQVMsUUFBUTs7R0FFdkIsSUFBSSxVQUFVLE9BQU8sSUFBSSxLQUFLLE1BQU0sTUFBTSxPQUFPLE9BQU8sSUFBSSxLQUFLO0dBQ2pFLElBQUksVUFBVSxPQUFPLElBQUksS0FBSyxNQUFNLE9BQU8sT0FBTyxPQUFPLElBQUksS0FBSzs7R0FFbEUsSUFBSSxhQUFhLEtBQUssWUFBWSxXQUFXO0dBQzdDLElBQUksbUJBQW1CLFdBQVc7R0FDbEMsSUFBSSxHQUFHOzs7R0FHUCxJQUFJLGNBQWMsTUFBTTtHQUN4QixLQUFLLElBQUksSUFBSSxJQUFJLGFBQWEsS0FBSztJQUNsQyxJQUFJLE1BQU0sR0FBRyxNQUFNLGNBQWMsR0FBRyxhQUFhO0tBQ2hELE1BQU0sT0FBTyxHQUFHO0tBQ2hCOzs7OztHQUtGLEtBQUssSUFBSSxHQUFHLElBQUksa0JBQWtCLEtBQUs7SUFDdEMsSUFBSSxRQUFRLFdBQVc7SUFDdkIsY0FBYyxNQUFNO0lBQ3BCLEtBQUssSUFBSSxHQUFHLElBQUksYUFBYSxLQUFLO0tBQ2pDLElBQUksTUFBTSxHQUFHLE1BQU0sY0FBYyxNQUFNLElBQUk7TUFDMUMsTUFBTSxPQUFPLEdBQUc7TUFDaEI7Ozs7OztHQU1ILFFBQVEsTUFBTSxJQUFJLFNBQVMsTUFBTTtJQUNoQyxPQUFPO0tBQ04sU0FBUyxLQUFLLE1BQU07S0FDcEIsTUFBTSxHQUFHLE1BQU07S0FDZixZQUFZLEtBQUssTUFBTTs7OztHQUl6QixTQUFTLE9BQU8sSUFBSSxTQUFTLE1BQU07SUFDbEMsT0FBTztLQUNOLFNBQVMsS0FBSyxNQUFNLFlBQVk7S0FDaEMsTUFBTSxHQUFHLE1BQU07S0FDZixZQUFZLEtBQUssTUFBTTs7OztHQUl6QixPQUFPLE9BQU8sT0FBTzs7OztDQUl2QixLQUFLLGlCQUFpQixVQUFVLE1BQU07RUFDckMsS0FBSyxpQkFBaUI7RUFDdEIsbUJBQW1CLE1BQU0sS0FBSyxhQUFhLEtBQUssTUFBTSxLQUFLLFlBQVksT0FBTyxPQUFPLEtBQUssV0FBVztHQUNwRyxPQUFPOzs7OztDQUtULEtBQUssMEJBQTBCLFNBQVMsUUFBUSxVQUFVO0VBQ3pELG1CQUFtQixNQUFNLEtBQUssYUFBYSxHQUFHLE1BQU0saUJBQWlCLFFBQVEsVUFBVSxNQUFNLEtBQUssV0FBVztHQUM1RyxPQUFPOzs7O0NBSVQsS0FBSywyQkFBMkIsU0FBUyxTQUFTLFVBQVU7RUFDM0QsbUJBQW1CLE1BQU0sS0FBSyxhQUFhLEdBQUcsTUFBTSxrQkFBa0IsU0FBUyxVQUFVLE1BQU0sS0FBSyxXQUFXO0dBQzlHLE9BQU87Ozs7Q0FJVCxLQUFLLGtCQUFrQixTQUFTLFFBQVE7RUFDdkMsbUJBQW1CLFFBQVEsS0FBSyxhQUFhLEdBQUcsTUFBTSxpQkFBaUIsUUFBUSxLQUFLLFdBQVc7R0FDOUYsT0FBTzs7OztDQUlULEtBQUssbUJBQW1CLFNBQVMsU0FBUztFQUN6QyxtQkFBbUIsUUFBUSxLQUFLLGFBQWEsR0FBRyxNQUFNLGtCQUFrQixTQUFTLEtBQUssV0FBVztHQUNoRyxPQUFPOzs7O0NBSVQsS0FBSyxvQkFBb0IsV0FBVztFQUNuQyxtQkFBbUIsT0FBTyxLQUFLLGFBQWEsS0FBSyxXQUFXO0dBQzNELE9BQU87Ozs7O0FBS1Y7QUNsSUEsUUFBUSxPQUFPO0NBQ2QsVUFBVSxlQUFlLFdBQVc7Q0FDcEMsT0FBTztFQUNOLFVBQVU7RUFDVixPQUFPO0dBQ04sT0FBTzs7RUFFUixZQUFZO0VBQ1osY0FBYztFQUNkLGtCQUFrQjtHQUNqQixhQUFhO0dBQ2IsTUFBTTs7RUFFUCxhQUFhLEdBQUcsT0FBTyxZQUFZOzs7QUFHckM7QUNoQkEsUUFBUSxPQUFPO0NBQ2QsV0FBVyx3REFBdUIsU0FBUyxRQUFRLG9CQUFvQjtDQUN2RSxJQUFJLE9BQU87O0NBRVgsS0FBSyxVQUFVOztDQUVmLG1CQUFtQixTQUFTLEtBQUssU0FBUyxjQUFjO0VBQ3ZELEtBQUssZUFBZTtFQUNwQixLQUFLLFVBQVU7OztDQUdoQixLQUFLLElBQUk7RUFDUixrQkFBa0IsRUFBRSxZQUFZOzs7Q0FHakMsS0FBSyxvQkFBb0IsV0FBVztFQUNuQyxHQUFHLEtBQUssb0JBQW9CO0dBQzNCLG1CQUFtQixPQUFPLEtBQUssb0JBQW9CLEtBQUssV0FBVztJQUNsRSxtQkFBbUIsZUFBZSxLQUFLLG9CQUFvQixLQUFLLFNBQVMsYUFBYTtLQUNyRixLQUFLLGFBQWEsS0FBSztLQUN2QixLQUFLLHFCQUFxQjtLQUMxQixPQUFPOzs7Ozs7QUFNWjtBQzNCQSxRQUFRLE9BQU87Q0FDZCxVQUFVLG1CQUFtQixXQUFXO0NBQ3hDLE9BQU87RUFDTixVQUFVO0VBQ1YsT0FBTztFQUNQLFlBQVk7RUFDWixjQUFjO0VBQ2Qsa0JBQWtCO0VBQ2xCLGFBQWEsR0FBRyxPQUFPLFlBQVk7OztBQUdyQztBQ1hBLFFBQVEsT0FBTztDQUNkLFdBQVcsaUNBQWMsU0FBUyxnQkFBZ0I7Q0FDbEQsSUFBSSxPQUFPOztDQUVYLEtBQUssU0FBUyxlQUFlLE9BQU8sS0FBSzs7O0FBRzFDO0FDUEEsUUFBUSxPQUFPO0NBQ2QsVUFBVSw2QkFBVSxTQUFTLGdCQUFnQjtDQUM3QyxPQUFPO0VBQ04sT0FBTztHQUNOLFNBQVM7O0VBRVYsTUFBTSxTQUFTLE9BQU8sU0FBUztHQUM5QixJQUFJLGFBQWEsRUFBRSxZQUFZO0dBQy9CLE1BQU0sYUFBYTs7R0FFbkIsSUFBSSxRQUFRLFFBQVEsS0FBSztHQUN6QixNQUFNLEtBQUssVUFBVSxXQUFXO0lBQy9CLElBQUksT0FBTyxNQUFNLElBQUksR0FBRyxNQUFNO0lBQzlCLElBQUksS0FBSyxPQUFPLEtBQUssTUFBTTtLQUMxQixHQUFHLGFBQWEsY0FBYyxFQUFFLFlBQVk7V0FDdEM7S0FDTixJQUFJLFNBQVMsSUFBSTs7S0FFakIsT0FBTyxpQkFBaUIsUUFBUSxZQUFZO01BQzNDLE1BQU0sT0FBTyxXQUFXO09BQ3ZCLE1BQU0sUUFBUSxNQUFNLE9BQU87T0FDM0IsZUFBZSxPQUFPLE1BQU07O1FBRTNCOztLQUVILElBQUksTUFBTTtNQUNULE9BQU8sY0FBYzs7Ozs7RUFLekIsYUFBYSxHQUFHLE9BQU8sWUFBWTs7O0FBR3JDO0FDbENBLFFBQVEsT0FBTztDQUNkLFdBQVcsMENBQWUsU0FBUyxRQUFRLGNBQWM7Q0FDekQsSUFBSSxPQUFPOztDQUVYLEtBQUssY0FBYyxXQUFXO0VBQzdCLE9BQU8sYUFBYTtHQUNuQixLQUFLLGFBQWE7R0FDbEIsS0FBSyxLQUFLLFFBQVE7OztBQUdyQjtBQ1ZBLFFBQVEsT0FBTztDQUNkLFVBQVUsV0FBVyxXQUFXO0NBQ2hDLE9BQU87RUFDTixPQUFPO0VBQ1AsWUFBWTtFQUNaLGNBQWM7RUFDZCxrQkFBa0I7R0FDakIsU0FBUzs7RUFFVixhQUFhLEdBQUcsT0FBTyxZQUFZOzs7QUFHckM7QUNaQSxRQUFRLE9BQU87Q0FDZCxXQUFXLDZIQUFzQixTQUFTLGdCQUFnQixvQkFBb0Isd0JBQXdCLFFBQVEsY0FBYyxRQUFROztDQUVwSSxJQUFJLE9BQU87O0NBRVgsS0FBSyxVQUFVO0NBQ2YsS0FBSyxPQUFPOztDQUVaLEtBQUssZUFBZSxXQUFXO0VBQzlCLE9BQU8sYUFBYTtHQUNuQixLQUFLLGFBQWE7R0FDbEIsS0FBSzs7RUFFTixLQUFLLE9BQU87RUFDWixLQUFLLFVBQVU7OztDQUdoQixLQUFLLE1BQU0sYUFBYTtDQUN4QixLQUFLLElBQUk7RUFDUixhQUFhLEVBQUUsWUFBWTtFQUMzQixrQkFBa0IsRUFBRSxZQUFZO0VBQ2hDLGlCQUFpQixFQUFFLFlBQVk7RUFDL0IsbUJBQW1CLEVBQUUsWUFBWTtFQUNqQyxjQUFjLEVBQUUsWUFBWTtFQUM1QixXQUFXLEVBQUUsWUFBWTtFQUN6QixTQUFTLEVBQUUsWUFBWTs7O0NBR3hCLEtBQUssbUJBQW1CLHVCQUF1QjtDQUMvQyxLQUFLLFFBQVE7Q0FDYixLQUFLLFFBQVE7Q0FDYixLQUFLLGVBQWU7O0NBRXBCLG1CQUFtQixTQUFTLEtBQUssU0FBUyxjQUFjO0VBQ3ZELEtBQUssZUFBZTs7RUFFcEIsSUFBSSxDQUFDLEVBQUUsWUFBWSxLQUFLLFVBQVU7R0FDakMsS0FBSyxjQUFjLEVBQUUsS0FBSyxLQUFLLGNBQWMsU0FBUyxNQUFNO0lBQzNELE9BQU8sS0FBSyxnQkFBZ0IsS0FBSyxRQUFROzs7RUFHM0MsS0FBSyxVQUFVOzs7Q0FHaEIsT0FBTyxPQUFPLFlBQVksU0FBUyxVQUFVO0VBQzVDLEtBQUssY0FBYzs7O0NBR3BCLEtBQUssZ0JBQWdCLFNBQVMsS0FBSztFQUNsQyxJQUFJLE9BQU8sUUFBUSxhQUFhO0dBQy9CLEtBQUssT0FBTztHQUNaLEVBQUUsMEJBQTBCLFlBQVk7R0FDeEM7O0VBRUQsZUFBZSxRQUFRLEtBQUssS0FBSyxTQUFTLFNBQVM7R0FDbEQsSUFBSSxRQUFRLFlBQVksVUFBVTtJQUNqQyxLQUFLO0lBQ0w7O0dBRUQsS0FBSyxVQUFVO0dBQ2YsS0FBSyxPQUFPO0dBQ1osRUFBRSwwQkFBMEIsU0FBUzs7R0FFckMsS0FBSyxjQUFjLEVBQUUsS0FBSyxLQUFLLGNBQWMsU0FBUyxNQUFNO0lBQzNELE9BQU8sS0FBSyxnQkFBZ0IsS0FBSyxRQUFROzs7OztDQUs1QyxLQUFLLGdCQUFnQixXQUFXO0VBQy9CLGVBQWUsT0FBTyxLQUFLOzs7Q0FHNUIsS0FBSyxnQkFBZ0IsV0FBVztFQUMvQixlQUFlLE9BQU8sS0FBSzs7O0NBRzVCLEtBQUssV0FBVyxTQUFTLE9BQU87RUFDL0IsSUFBSSxlQUFlLHVCQUF1QixRQUFRLE9BQU8sZ0JBQWdCLENBQUMsT0FBTztFQUNqRixLQUFLLFFBQVEsWUFBWSxPQUFPO0VBQ2hDLEtBQUssUUFBUTtFQUNiLEtBQUssUUFBUTs7O0NBR2QsS0FBSyxjQUFjLFVBQVUsT0FBTyxNQUFNO0VBQ3pDLEtBQUssUUFBUSxlQUFlLE9BQU87RUFDbkMsS0FBSyxRQUFROzs7Q0FHZCxLQUFLLG9CQUFvQixVQUFVLGFBQWE7RUFDL0MsZUFBZSxZQUFZLEtBQUssU0FBUzs7O0FBRzNDO0FDN0ZBLFFBQVEsT0FBTztDQUNkLFVBQVUsa0JBQWtCLFdBQVc7Q0FDdkMsT0FBTztFQUNOLFVBQVU7RUFDVixPQUFPO0VBQ1AsWUFBWTtFQUNaLGNBQWM7RUFDZCxrQkFBa0I7RUFDbEIsYUFBYSxHQUFHLE9BQU8sWUFBWTs7O0FBR3JDO0FDWEEsUUFBUSxPQUFPO0NBQ2QsV0FBVyx3Q0FBcUIsU0FBUyxnQkFBZ0I7Q0FDekQsSUFBSSxPQUFPOztDQUVYLEtBQUssU0FBUyxlQUFlLE9BQU8sS0FBSzs7O0FBRzFDO0FDUEEsUUFBUSxPQUFPO0NBQ2QsVUFBVSxvQ0FBaUIsU0FBUyxnQkFBZ0I7Q0FDcEQsT0FBTztFQUNOLE1BQU0sU0FBUyxPQUFPLFNBQVM7R0FDOUIsSUFBSSxhQUFhLEVBQUUsWUFBWTtHQUMvQixNQUFNLGFBQWE7O0dBRW5CLElBQUksUUFBUSxRQUFRLEtBQUs7R0FDekIsTUFBTSxLQUFLLFVBQVUsV0FBVztJQUMvQixJQUFJLE9BQU8sTUFBTSxJQUFJLEdBQUcsTUFBTTtJQUM5QixJQUFJLFNBQVMsSUFBSTs7SUFFakIsT0FBTyxpQkFBaUIsUUFBUSxZQUFZO0tBQzNDLE1BQU0sT0FBTyxXQUFXO01BQ3ZCLGVBQWUsT0FBTyxLQUFLLGdCQUFnQixPQUFPLFFBQVEsS0FBSyxNQUFNLE1BQU0sU0FBUyxVQUFVO09BQzdGLEdBQUcsV0FBVyxHQUFHO1FBQ2hCLE1BQU0sYUFBYTtjQUNiO1FBQ04sTUFBTSxhQUFhLFNBQVMsS0FBSyxNQUFNLFNBQVMsTUFBTTs7OztPQUl2RDs7SUFFSCxJQUFJLE1BQU07S0FDVCxPQUFPLFdBQVc7O0lBRW5CLE1BQU0sSUFBSSxHQUFHLFFBQVE7OztFQUd2QixhQUFhLEdBQUcsT0FBTyxZQUFZOzs7QUFHckM7QUNqQ0EsUUFBUSxPQUFPO0NBQ2QsV0FBVyxnSUFBbUIsU0FBUyxRQUFRLFNBQVMsUUFBUSxjQUFjLGdCQUFnQix3QkFBd0IsZUFBZTtDQUNySSxJQUFJLE9BQU87O0NBRVgsS0FBSyxjQUFjOztDQUVuQixLQUFLLGNBQWM7Q0FDbkIsS0FBSyxhQUFhO0NBQ2xCLEtBQUssT0FBTztDQUNaLEtBQUssVUFBVTs7Q0FFZixLQUFLLElBQUk7RUFDUixjQUFjLEVBQUUsWUFBWSxnQ0FBZ0MsQ0FBQyxPQUFPLEtBQUs7OztDQUcxRSxPQUFPLGlCQUFpQixTQUFTLFVBQVU7RUFDMUMsT0FBTyxFQUFFLFlBQVksY0FBYyxlQUFlLFNBQVM7OztDQUc1RCxPQUFPLFFBQVEsU0FBUyxTQUFTO0VBQ2hDLE9BQU8sUUFBUSxRQUFRLGNBQWM7OztDQUd0QyxjQUFjLHlCQUF5QixTQUFTLElBQUk7RUFDbkQsSUFBSSxHQUFHLFVBQVUsZ0JBQWdCO0dBQ2hDLElBQUksTUFBTSxDQUFDLEVBQUUsUUFBUSxLQUFLLGVBQWUsS0FBSyxZQUFZLEdBQUcsUUFBUTtHQUNyRSxLQUFLLGNBQWM7R0FDbkIsT0FBTzs7RUFFUixJQUFJLEdBQUcsVUFBVSxnQkFBZ0I7R0FDaEMsS0FBSyxhQUFhLEdBQUc7R0FDckIsS0FBSyxFQUFFLGNBQWMsRUFBRTtXQUNmO1dBQ0EsQ0FBQyxPQUFPLEtBQUs7O0dBRXJCLE9BQU87Ozs7Q0FJVCxLQUFLLFVBQVU7O0NBRWYsZUFBZSx5QkFBeUIsU0FBUyxJQUFJO0VBQ3BELE9BQU8sT0FBTyxXQUFXO0dBQ3hCLElBQUksR0FBRyxVQUFVLFVBQVU7SUFDMUIsSUFBSSxLQUFLLFlBQVksV0FBVyxHQUFHO0tBQ2xDLE9BQU8sYUFBYTtNQUNuQixLQUFLLGFBQWE7TUFDbEIsS0FBSzs7V0FFQTtLQUNOLEtBQUssSUFBSSxJQUFJLEdBQUcsU0FBUyxLQUFLLFlBQVksUUFBUSxJQUFJLFFBQVEsS0FBSztNQUNsRSxJQUFJLEtBQUssWUFBWSxHQUFHLFVBQVUsR0FBRyxLQUFLO09BQ3pDLE9BQU8sYUFBYTtRQUNuQixLQUFLLGFBQWE7UUFDbEIsS0FBSyxDQUFDLEtBQUssWUFBWSxFQUFFLE1BQU0sS0FBSyxZQUFZLEVBQUUsR0FBRyxRQUFRLEtBQUssWUFBWSxFQUFFLEdBQUc7O09BRXBGOzs7OztRQUtDLElBQUksR0FBRyxVQUFVLFVBQVU7SUFDL0IsT0FBTyxhQUFhO0tBQ25CLEtBQUssYUFBYTtLQUNsQixLQUFLLEdBQUc7OztHQUdWLEtBQUssV0FBVyxHQUFHOzs7OztDQUtyQixlQUFlLFNBQVMsS0FBSyxTQUFTLFVBQVU7RUFDL0MsR0FBRyxTQUFTLE9BQU8sR0FBRztHQUNyQixPQUFPLE9BQU8sV0FBVztJQUN4QixLQUFLLFdBQVc7O1NBRVg7R0FDTixLQUFLLFVBQVU7Ozs7O0NBS2pCLElBQUksa0JBQWtCLE9BQU8sT0FBTyxvQkFBb0IsV0FBVztFQUNsRSxHQUFHLEtBQUssZUFBZSxLQUFLLFlBQVksU0FBUyxHQUFHOztHQUVuRCxHQUFHLGFBQWEsT0FBTyxhQUFhLEtBQUs7SUFDeEMsS0FBSyxZQUFZLFFBQVEsU0FBUyxTQUFTO0tBQzFDLEdBQUcsUUFBUSxVQUFVLGFBQWEsS0FBSztNQUN0QyxLQUFLLGNBQWMsYUFBYTtNQUNoQyxLQUFLLFVBQVU7Ozs7O0dBS2xCLEdBQUcsS0FBSyxXQUFXLEVBQUUsUUFBUSxVQUFVLEtBQUs7SUFDM0MsS0FBSyxjQUFjLEtBQUssWUFBWSxHQUFHOztHQUV4QyxLQUFLLFVBQVU7R0FDZjs7OztDQUlGLE9BQU8sT0FBTyx3QkFBd0IsU0FBUyxVQUFVLFVBQVU7O0VBRWxFLEdBQUcsT0FBTyxZQUFZLGVBQWUsT0FBTyxZQUFZLGVBQWUsRUFBRSxRQUFRLFdBQVcsS0FBSzs7R0FFaEcsS0FBSyxPQUFPO0dBQ1o7O0VBRUQsR0FBRyxhQUFhLFdBQVc7O0dBRTFCLEdBQUcsS0FBSyxlQUFlLEtBQUssWUFBWSxTQUFTLEdBQUc7SUFDbkQsT0FBTyxhQUFhO0tBQ25CLEtBQUssYUFBYTtLQUNsQixLQUFLLEtBQUssWUFBWSxHQUFHOztVQUVwQjs7SUFFTixJQUFJLGNBQWMsT0FBTyxPQUFPLG9CQUFvQixXQUFXO0tBQzlELEdBQUcsS0FBSyxlQUFlLEtBQUssWUFBWSxTQUFTLEdBQUc7TUFDbkQsT0FBTyxhQUFhO09BQ25CLEtBQUssYUFBYTtPQUNsQixLQUFLLEtBQUssWUFBWSxHQUFHOzs7S0FHM0I7OztTQUdJOztHQUVOLEtBQUssT0FBTzs7OztDQUlkLE9BQU8sT0FBTyx3QkFBd0IsV0FBVzs7RUFFaEQsS0FBSyxjQUFjOztFQUVuQixHQUFHLEVBQUUsUUFBUSxVQUFVLEtBQUs7O0dBRTNCLElBQUksY0FBYyxPQUFPLE9BQU8sb0JBQW9CLFdBQVc7SUFDOUQsR0FBRyxLQUFLLGVBQWUsS0FBSyxZQUFZLFNBQVMsR0FBRztLQUNuRCxPQUFPLGFBQWE7TUFDbkIsS0FBSyxhQUFhO01BQ2xCLEtBQUssS0FBSyxZQUFZLEdBQUc7OztJQUczQjs7Ozs7O0NBTUgsT0FBTyxPQUFPLHFDQUFxQyxTQUFTLGFBQWE7RUFDeEUsS0FBSyxXQUFXLGdCQUFnQjs7O0NBR2pDLEtBQUssY0FBYyxZQUFZO0VBQzlCLElBQUksQ0FBQyxLQUFLLFVBQVU7R0FDbkIsT0FBTzs7RUFFUixPQUFPLEtBQUssU0FBUyxTQUFTOzs7Q0FHL0IsS0FBSyxnQkFBZ0IsVUFBVSxXQUFXO0VBQ3pDLE9BQU8sYUFBYTtHQUNuQixLQUFLOzs7O0NBSVAsS0FBSyxnQkFBZ0IsV0FBVztFQUMvQixPQUFPLGFBQWE7Ozs7QUFJdEI7QUNoTEEsUUFBUSxPQUFPO0NBQ2QsVUFBVSxlQUFlLFdBQVc7Q0FDcEMsT0FBTztFQUNOLFVBQVU7RUFDVixPQUFPO0VBQ1AsWUFBWTtFQUNaLGNBQWM7RUFDZCxrQkFBa0I7R0FDakIsYUFBYTs7RUFFZCxhQUFhLEdBQUcsT0FBTyxZQUFZOzs7QUFHckM7QUNiQSxRQUFRLE9BQU87Q0FDZCxXQUFXLG9GQUFtQixTQUFTLGtCQUFrQix3QkFBd0IsZ0JBQWdCO0NBQ2pHLElBQUksT0FBTzs7Q0FFWCxLQUFLLE9BQU8sdUJBQXVCLFFBQVEsS0FBSztDQUNoRCxLQUFLLE9BQU87Q0FDWixLQUFLLGNBQWM7Q0FDbkIsS0FBSyxJQUFJO0VBQ1IsUUFBUSxFQUFFLFlBQVk7RUFDdEIsYUFBYSxFQUFFLFlBQVk7RUFDM0IsT0FBTyxFQUFFLFlBQVk7RUFDckIsUUFBUSxFQUFFLFlBQVk7RUFDdEIsVUFBVSxFQUFFLFlBQVk7RUFDeEIsU0FBUyxFQUFFLFlBQVk7RUFDdkIsVUFBVSxFQUFFLFlBQVk7RUFDeEIsWUFBWSxFQUFFLFlBQVk7RUFDMUIsV0FBVyxFQUFFLFlBQVk7RUFDekIsaUJBQWlCLEVBQUUsWUFBWTtFQUMvQixpQkFBaUIsRUFBRSxZQUFZO0VBQy9CLGlCQUFpQixFQUFFLFlBQVk7RUFDL0IsUUFBUSxFQUFFLFlBQVk7OztDQUd2QixLQUFLLG1CQUFtQixLQUFLLEtBQUssV0FBVztDQUM3QyxJQUFJLENBQUMsRUFBRSxZQUFZLEtBQUssU0FBUyxDQUFDLEVBQUUsWUFBWSxLQUFLLEtBQUssU0FBUyxDQUFDLEVBQUUsWUFBWSxLQUFLLEtBQUssS0FBSyxPQUFPOztFQUV2RyxJQUFJLFFBQVEsS0FBSyxLQUFLLEtBQUssS0FBSyxHQUFHLE1BQU07RUFDekMsUUFBUSxNQUFNLElBQUksVUFBVSxNQUFNO0dBQ2pDLE9BQU8sS0FBSyxPQUFPLFFBQVEsUUFBUSxJQUFJLFFBQVEsUUFBUSxJQUFJLE9BQU87OztFQUduRSxJQUFJLE1BQU0sUUFBUSxXQUFXLEdBQUc7R0FDL0IsS0FBSyxjQUFjO0dBQ25CLE1BQU0sT0FBTyxNQUFNLFFBQVEsU0FBUzs7O0VBR3JDLEtBQUssT0FBTyxNQUFNLEtBQUs7RUFDdkIsSUFBSSxjQUFjLE1BQU0sSUFBSSxVQUFVLFNBQVM7R0FDOUMsT0FBTyxRQUFRLE9BQU8sR0FBRyxnQkFBZ0IsUUFBUSxNQUFNLEdBQUc7S0FDeEQsS0FBSzs7O0VBR1IsSUFBSSxDQUFDLEtBQUssaUJBQWlCLEtBQUssU0FBUyxHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sS0FBSyxXQUFXO0dBQzdFLEtBQUssbUJBQW1CLEtBQUssaUJBQWlCLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLE1BQU07OztDQUc5RSxJQUFJLENBQUMsRUFBRSxZQUFZLEtBQUssU0FBUyxDQUFDLEVBQUUsWUFBWSxLQUFLLEtBQUssWUFBWTtFQUNyRSxJQUFJLENBQUMsRUFBRSxZQUFZLEtBQUssTUFBTSxRQUFRLE1BQU0sZUFBZTtHQUMxRCxJQUFJLE1BQU0sRUFBRSxLQUFLLEtBQUssTUFBTSxRQUFRLE1BQU0sY0FBYyxTQUFTLEdBQUcsRUFBRSxPQUFPLEVBQUUsY0FBYyxLQUFLLEtBQUs7R0FDdkcsS0FBSyxPQUFPLElBQUk7R0FDaEIsSUFBSSxDQUFDLEVBQUUsWUFBWSxNQUFNOztJQUV4QixJQUFJLENBQUMsS0FBSyxpQkFBaUIsS0FBSyxTQUFTLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxJQUFJLFlBQVk7S0FDN0UsS0FBSyxtQkFBbUIsS0FBSyxpQkFBaUIsT0FBTyxDQUFDLENBQUMsSUFBSSxJQUFJLE9BQU8sTUFBTSxJQUFJOzs7OztDQUtwRixLQUFLLGtCQUFrQjs7Q0FFdkIsZUFBZSxZQUFZLEtBQUssU0FBUyxRQUFRO0VBQ2hELEtBQUssa0JBQWtCLEVBQUUsT0FBTzs7O0NBR2pDLEtBQUssYUFBYSxVQUFVLEtBQUs7RUFDaEMsSUFBSSxLQUFLLGFBQWE7R0FDckIsT0FBTzs7RUFFUixLQUFLLEtBQUssT0FBTyxLQUFLLEtBQUssUUFBUTtFQUNuQyxLQUFLLEtBQUssS0FBSyxPQUFPLEtBQUssS0FBSyxLQUFLLFFBQVE7RUFDN0MsS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLO0VBQ3pCLEtBQUssTUFBTTs7O0NBR1osS0FBSyxxQkFBcUIsWUFBWTtFQUNyQyxJQUFJLEtBQUs7RUFDVCxJQUFJLEtBQUssS0FBSyxNQUFNLElBQUk7R0FDdkIsTUFBTSxLQUFLLEtBQUssTUFBTSxLQUFLOztFQUU1QixJQUFJLEtBQUssS0FBSyxNQUFNLElBQUk7R0FDdkIsTUFBTSxLQUFLLEtBQUssTUFBTSxLQUFLOztFQUU1QixJQUFJLEtBQUssS0FBSyxNQUFNLElBQUk7R0FDdkIsTUFBTSxLQUFLLEtBQUssTUFBTSxLQUFLOztFQUU1QixJQUFJLEtBQUssS0FBSyxNQUFNLElBQUk7R0FDdkIsTUFBTSxLQUFLLEtBQUssTUFBTSxLQUFLOztFQUU1QixJQUFJLEtBQUssS0FBSyxNQUFNLElBQUk7R0FDdkIsTUFBTSxLQUFLLEtBQUssTUFBTTs7O0VBR3ZCLEtBQUssTUFBTSxRQUFRLFNBQVM7RUFDNUIsS0FBSyxNQUFNOzs7Q0FHWixLQUFLLGNBQWMsV0FBVztFQUM3QixJQUFJLGNBQWMsR0FBRyxPQUFPLFlBQVksMkJBQTJCLEtBQUssS0FBSyxXQUFXO0VBQ3hGLE9BQU8saUJBQWlCOzs7Q0FHekIsS0FBSyxjQUFjLFlBQVk7RUFDOUIsS0FBSyxNQUFNLFlBQVksS0FBSyxNQUFNLEtBQUs7RUFDdkMsS0FBSyxNQUFNOzs7QUFHYjtBQzFHQSxRQUFRLE9BQU87Q0FDZCxVQUFVLGVBQWUsQ0FBQyxZQUFZLFNBQVMsVUFBVTtDQUN6RCxPQUFPO0VBQ04sT0FBTztFQUNQLFlBQVk7RUFDWixjQUFjO0VBQ2Qsa0JBQWtCO0dBQ2pCLE1BQU07R0FDTixNQUFNO0dBQ04sT0FBTzs7RUFFUixNQUFNLFNBQVMsT0FBTyxTQUFTLE9BQU8sTUFBTTtHQUMzQyxLQUFLLGNBQWMsS0FBSyxTQUFTLE1BQU07SUFDdEMsSUFBSSxXQUFXLFFBQVEsUUFBUTtJQUMvQixRQUFRLE9BQU87SUFDZixTQUFTLFVBQVU7Ozs7O0FBS3ZCO0FDcEJBLFFBQVEsT0FBTztDQUNkLFdBQVcsYUFBYSxXQUFXOztDQUVuQyxJQUFJLE9BQU87O0FBRVo7QUNMQSxRQUFRLE9BQU87Q0FDZCxVQUFVLFNBQVMsV0FBVztDQUM5QixPQUFPO0VBQ04sVUFBVTtFQUNWLE9BQU87RUFDUCxZQUFZO0VBQ1osY0FBYztFQUNkLGtCQUFrQjtHQUNqQixPQUFPOztFQUVSLGFBQWEsR0FBRyxPQUFPLFlBQVk7OztBQUdyQztBQ2JBLFFBQVEsT0FBTztDQUNkLFdBQVcsK0VBQWlCLFNBQVMsUUFBUSxnQkFBZ0IsZUFBZSxjQUFjO0NBQzFGLElBQUksT0FBTzs7Q0FFWCxJQUFJLGdCQUFnQixDQUFDLEVBQUUsWUFBWSxpQkFBaUIsRUFBRSxZQUFZOztDQUVsRSxLQUFLLFNBQVM7O0NBRWQsZUFBZSxZQUFZLEtBQUssU0FBUyxRQUFRO0VBQ2hELEtBQUssU0FBUyxFQUFFLE9BQU8sY0FBYyxPQUFPOzs7Q0FHN0MsS0FBSyxjQUFjLFdBQVc7RUFDN0IsT0FBTyxhQUFhOzs7O0NBSXJCLGVBQWUseUJBQXlCLFdBQVc7RUFDbEQsT0FBTyxPQUFPLFdBQVc7R0FDeEIsZUFBZSxZQUFZLEtBQUssU0FBUyxRQUFRO0lBQ2hELEtBQUssU0FBUyxFQUFFLE9BQU8sY0FBYyxPQUFPOzs7OztDQUsvQyxLQUFLLGNBQWMsVUFBVSxlQUFlO0VBQzNDLGNBQWM7RUFDZCxhQUFhLE1BQU07OztBQUdyQjtBQzlCQSxRQUFRLE9BQU87Q0FDZCxVQUFVLGFBQWEsV0FBVztDQUNsQyxPQUFPO0VBQ04sVUFBVTtFQUNWLE9BQU87RUFDUCxZQUFZO0VBQ1osY0FBYztFQUNkLGtCQUFrQjtFQUNsQixhQUFhLEdBQUcsT0FBTyxZQUFZOzs7QUFHckM7QUNYQSxRQUFRLE9BQU87Q0FDZCxXQUFXLCtGQUF3QixTQUFTLFFBQVEsZ0JBQWdCLGNBQWMsd0JBQXdCO0NBQzFHLElBQUksT0FBTzs7Q0FFWCxLQUFLLElBQUk7RUFDUixhQUFhLEVBQUUsWUFBWTs7O0NBRzVCLEtBQUssZ0JBQWdCLFdBQVc7RUFDL0IsZUFBZSxTQUFTLEtBQUssU0FBUyxTQUFTO0dBQzlDLENBQUMsT0FBTyxPQUFPLFNBQVMsUUFBUSxTQUFTLE9BQU87SUFDL0MsSUFBSSxlQUFlLHVCQUF1QixRQUFRLE9BQU8sZ0JBQWdCLENBQUMsT0FBTztJQUNqRixRQUFRLFlBQVksT0FBTzs7R0FFNUIsSUFBSSxDQUFDLEVBQUUsWUFBWSxpQkFBaUIsRUFBRSxZQUFZLGdCQUFnQixRQUFRLGFBQWEsU0FBUyxDQUFDLEdBQUc7SUFDbkcsUUFBUSxXQUFXLGFBQWE7VUFDMUI7SUFDTixRQUFRLFdBQVc7O0dBRXBCLEVBQUUscUJBQXFCOzs7O0FBSTFCO0FDdkJBLFFBQVEsT0FBTztDQUNkLFVBQVUsb0JBQW9CLFdBQVc7Q0FDekMsT0FBTztFQUNOLFVBQVU7RUFDVixPQUFPO0VBQ1AsWUFBWTtFQUNaLGNBQWM7RUFDZCxrQkFBa0I7RUFDbEIsYUFBYSxHQUFHLE9BQU8sWUFBWTs7O0FBR3JDO0FDWEEsUUFBUSxPQUFPO0NBQ2QsVUFBVSxZQUFZLFdBQVc7Q0FDakMsTUFBTTtFQUNMLFVBQVU7RUFDVixTQUFTO0VBQ1QsTUFBTSxTQUFTLE9BQU8sU0FBUyxNQUFNLFNBQVM7R0FDN0MsUUFBUSxZQUFZLEtBQUssU0FBUyxPQUFPO0lBQ3hDLE9BQU87O0dBRVIsUUFBUSxTQUFTLEtBQUssU0FBUyxPQUFPO0lBQ3JDLE9BQU87Ozs7O0FBS1g7QUNmQSxRQUFRLE9BQU87Q0FDZCxRQUFRLGVBQWU7QUFDeEI7Q0FDQyxPQUFPLFNBQVMsWUFBWSxNQUFNO0VBQ2pDLFFBQVEsT0FBTyxNQUFNOztHQUVwQixhQUFhO0dBQ2IsVUFBVTtHQUNWLFFBQVEsS0FBSyxLQUFLLE1BQU07O0dBRXhCLFlBQVksU0FBUyxLQUFLO0lBQ3pCLElBQUksSUFBSSxLQUFLLEtBQUssVUFBVTtLQUMzQixHQUFHLEtBQUssU0FBUyxHQUFHLFVBQVUsS0FBSztNQUNsQyxPQUFPLEtBQUssU0FBUzs7O0lBR3ZCLE9BQU87OztHQUdSLFlBQVk7SUFDWCxPQUFPO0lBQ1AsUUFBUTs7OztFQUlWLFFBQVEsT0FBTyxNQUFNO0VBQ3JCLFFBQVEsT0FBTyxNQUFNO0dBQ3BCLE9BQU8sS0FBSyxJQUFJLE1BQU0sS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUc7OztFQUcxQyxJQUFJLFNBQVMsS0FBSyxLQUFLLE1BQU07RUFDN0IsSUFBSSxPQUFPLFdBQVcsYUFBYTtHQUNsQyxLQUFLLElBQUksSUFBSSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7SUFDdkMsSUFBSSxPQUFPLE9BQU8sR0FBRztJQUNyQixJQUFJLEtBQUssV0FBVyxHQUFHO0tBQ3RCOztJQUVELElBQUksU0FBUyxPQUFPLEdBQUc7SUFDdkIsSUFBSSxPQUFPLFdBQVcsR0FBRztLQUN4Qjs7O0lBR0QsSUFBSSxhQUFhLE9BQU8sT0FBTyxjQUFjOztJQUU3QyxJQUFJLEtBQUssV0FBVyxnQ0FBZ0M7S0FDbkQsS0FBSyxXQUFXLE1BQU0sS0FBSztNQUMxQixJQUFJLEtBQUssT0FBTztNQUNoQixhQUFhLEtBQUssT0FBTztNQUN6QixVQUFVOztXQUVMLElBQUksS0FBSyxXQUFXLGlDQUFpQztLQUMzRCxLQUFLLFdBQVcsT0FBTyxLQUFLO01BQzNCLElBQUksS0FBSyxPQUFPO01BQ2hCLGFBQWEsS0FBSyxPQUFPO01BQ3pCLFVBQVU7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQmhCO0FDdEVBLFFBQVEsT0FBTztDQUNkLFFBQVEsdUJBQVcsU0FBUyxTQUFTO0NBQ3JDLE9BQU8sU0FBUyxRQUFRLGFBQWEsT0FBTztFQUMzQyxRQUFRLE9BQU8sTUFBTTs7R0FFcEIsTUFBTTtHQUNOLE9BQU87O0dBRVAsZ0JBQWdCLENBQUMsUUFBUSxlQUFlOztHQUV4QyxlQUFlLFlBQVk7O0dBRTNCLFNBQVMsV0FBVztJQUNuQixJQUFJLFdBQVcsS0FBSyxZQUFZO0lBQ2hDLEdBQUcsVUFBVTtLQUNaLE9BQU8sU0FBUzs7O0lBR2pCLE9BQU87OztHQUdSLEtBQUssU0FBUyxPQUFPO0lBQ3BCLElBQUksUUFBUTtJQUNaLElBQUksUUFBUSxVQUFVLFFBQVE7O0tBRTdCLE9BQU8sTUFBTSxZQUFZLE9BQU8sRUFBRSxPQUFPO1dBQ25DOztLQUVOLE9BQU8sTUFBTSxZQUFZLE9BQU87Ozs7R0FJbEMsYUFBYSxXQUFXO0lBQ3ZCLE9BQU8sS0FBSyxjQUFjLEtBQUssU0FBUzs7O0dBR3pDLFVBQVUsU0FBUyxPQUFPO0lBQ3pCLElBQUksUUFBUTtJQUNaLElBQUksUUFBUSxVQUFVLFFBQVE7O0tBRTdCLE9BQU8sS0FBSyxZQUFZLE1BQU0sRUFBRSxPQUFPO1dBQ2pDOztLQUVOLElBQUksV0FBVyxNQUFNLFlBQVk7S0FDakMsR0FBRyxVQUFVO01BQ1osT0FBTyxTQUFTOztLQUVqQixXQUFXLE1BQU0sWUFBWTtLQUM3QixHQUFHLFVBQVU7TUFDWixPQUFPLFNBQVMsTUFBTSxPQUFPLFNBQVMsTUFBTTtPQUMzQyxPQUFPO1NBQ0wsS0FBSzs7S0FFVCxPQUFPOzs7O0dBSVQsT0FBTyxTQUFTLE9BQU87SUFDdEIsSUFBSSxRQUFRLFVBQVUsUUFBUTs7S0FFN0IsT0FBTyxLQUFLLFlBQVksU0FBUyxFQUFFLE9BQU87V0FDcEM7O0tBRU4sSUFBSSxXQUFXLEtBQUssWUFBWTtLQUNoQyxHQUFHLFVBQVU7TUFDWixPQUFPLFNBQVM7WUFDVjtNQUNOLE9BQU87Ozs7O0dBS1YsS0FBSyxTQUFTLE9BQU87SUFDcEIsSUFBSSxXQUFXLEtBQUssWUFBWTtJQUNoQyxJQUFJLFFBQVEsVUFBVSxRQUFRO0tBQzdCLElBQUksTUFBTTs7S0FFVixHQUFHLFlBQVksTUFBTSxRQUFRLFNBQVMsUUFBUTtNQUM3QyxNQUFNLFNBQVM7TUFDZixJQUFJLEtBQUs7O0tBRVYsT0FBTyxLQUFLLFlBQVksT0FBTyxFQUFFLE9BQU87V0FDbEM7O0tBRU4sR0FBRyxVQUFVO01BQ1osSUFBSSxNQUFNLFFBQVEsU0FBUyxRQUFRO09BQ2xDLE9BQU8sU0FBUyxNQUFNOztNQUV2QixPQUFPLFNBQVM7WUFDVjtNQUNOLE9BQU87Ozs7O0dBS1YsT0FBTyxXQUFXOztJQUVqQixJQUFJLFdBQVcsS0FBSyxZQUFZO0lBQ2hDLEdBQUcsVUFBVTtLQUNaLE9BQU8sU0FBUztXQUNWO0tBQ04sT0FBTzs7OztHQUlULE9BQU8sU0FBUyxPQUFPO0lBQ3RCLElBQUksUUFBUSxVQUFVLFFBQVE7OztLQUc3QixJQUFJLFlBQVksTUFBTSxNQUFNO0tBQzVCLElBQUksWUFBWSxVQUFVLEdBQUcsTUFBTSxRQUFRO0tBQzNDLElBQUksQ0FBQyxVQUFVLFdBQVcsV0FBVztNQUNwQzs7S0FFRCxZQUFZLFVBQVUsVUFBVSxHQUFHOztLQUVuQyxPQUFPLEtBQUssWUFBWSxTQUFTLEVBQUUsT0FBTyxVQUFVLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxZQUFZLFVBQVUsQ0FBQztXQUN2RjtLQUNOLElBQUksV0FBVyxLQUFLLFlBQVk7S0FDaEMsR0FBRyxVQUFVO01BQ1osSUFBSSxPQUFPLFNBQVMsS0FBSztNQUN6QixJQUFJLFFBQVEsUUFBUSxPQUFPO09BQzFCLE9BQU8sS0FBSzs7TUFFYixJQUFJLENBQUMsS0FBSyxXQUFXLFdBQVc7T0FDL0IsT0FBTyxXQUFXLEtBQUs7O01BRXhCLE9BQU8sVUFBVSxPQUFPLGFBQWEsU0FBUztZQUN4QztNQUNOLE9BQU87Ozs7O0dBS1YsWUFBWSxTQUFTLE9BQU87SUFDM0IsSUFBSSxRQUFRLFVBQVUsUUFBUTs7S0FFN0IsT0FBTyxLQUFLLFlBQVksY0FBYyxFQUFFLE9BQU87V0FDekM7O0tBRU4sSUFBSSxXQUFXLEtBQUssWUFBWTtLQUNoQyxHQUFHLENBQUMsVUFBVTtNQUNiLE9BQU87O0tBRVIsSUFBSSxRQUFRLFFBQVEsU0FBUyxRQUFRO01BQ3BDLE9BQU8sU0FBUzs7S0FFakIsT0FBTyxDQUFDLFNBQVM7Ozs7R0FJbkIscUJBQXFCLFNBQVMsTUFBTSxNQUFNO0lBQ3pDLElBQUksRUFBRSxZQUFZLFNBQVMsRUFBRSxZQUFZLEtBQUssUUFBUTtLQUNyRCxPQUFPOztJQUVSLElBQUksS0FBSyxlQUFlLFFBQVEsVUFBVSxDQUFDLEdBQUc7S0FDN0MsSUFBSSxRQUFRLEtBQUssTUFBTSxNQUFNO0tBQzdCLElBQUksT0FBTztNQUNWLEtBQUssUUFBUSxNQUFNLEtBQUssTUFBTSxLQUFLLE1BQU07Ozs7SUFJM0MsT0FBTzs7O0dBR1Isc0JBQXNCLFNBQVMsTUFBTSxNQUFNO0lBQzFDLElBQUksRUFBRSxZQUFZLFNBQVMsRUFBRSxZQUFZLEtBQUssUUFBUTtLQUNyRCxPQUFPOztJQUVSLElBQUksS0FBSyxlQUFlLFFBQVEsVUFBVSxDQUFDLEdBQUc7S0FDN0MsSUFBSSxRQUFRLEtBQUssTUFBTSxNQUFNO0tBQzdCLElBQUksT0FBTztNQUNWLEtBQUssUUFBUSxNQUFNLEtBQUssTUFBTSxNQUFNLEtBQUssTUFBTSxNQUFNOzs7O0lBSXZELE9BQU87OztHQUdSLGFBQWEsU0FBUyxNQUFNO0lBQzNCLElBQUksS0FBSyxNQUFNLE9BQU87S0FDckIsT0FBTyxLQUFLLHFCQUFxQixNQUFNLEtBQUssTUFBTSxNQUFNO1dBQ2xEO0tBQ04sT0FBTzs7O0dBR1QsYUFBYSxTQUFTLE1BQU0sTUFBTTtJQUNqQyxPQUFPLFFBQVEsS0FBSztJQUNwQixPQUFPLEtBQUssb0JBQW9CLE1BQU07SUFDdEMsR0FBRyxDQUFDLEtBQUssTUFBTSxPQUFPO0tBQ3JCLEtBQUssTUFBTSxRQUFROztJQUVwQixJQUFJLE1BQU0sS0FBSyxNQUFNLE1BQU07SUFDM0IsS0FBSyxNQUFNLE1BQU0sT0FBTzs7O0lBR3hCLEtBQUssS0FBSyxjQUFjLFFBQVEsY0FBYyxLQUFLO0lBQ25ELE9BQU87O0dBRVIsYUFBYSxTQUFTLE1BQU0sTUFBTTtJQUNqQyxHQUFHLENBQUMsS0FBSyxNQUFNLE9BQU87S0FDckIsS0FBSyxNQUFNLFFBQVE7O0lBRXBCLE9BQU8sS0FBSyxvQkFBb0IsTUFBTTtJQUN0QyxLQUFLLE1BQU0sTUFBTSxLQUFLOzs7SUFHdEIsS0FBSyxLQUFLLGNBQWMsUUFBUSxjQUFjLEtBQUs7O0dBRXBELGdCQUFnQixVQUFVLE1BQU0sTUFBTTtJQUNyQyxRQUFRLEtBQUssRUFBRSxRQUFRLEtBQUssTUFBTSxPQUFPLE9BQU8sS0FBSyxNQUFNO0lBQzNELEtBQUssS0FBSyxjQUFjLFFBQVEsY0FBYyxLQUFLOztHQUVwRCxTQUFTLFNBQVMsTUFBTTtJQUN2QixLQUFLLEtBQUssT0FBTzs7R0FFbEIsUUFBUSxTQUFTLGFBQWEsS0FBSztJQUNsQyxLQUFLLEtBQUssTUFBTSxZQUFZLE1BQU0sTUFBTTs7O0dBR3pDLFlBQVksU0FBUyxNQUFNO0lBQzFCLFNBQVMsSUFBSSxRQUFRO0tBQ3BCLElBQUksU0FBUyxJQUFJO01BQ2hCLE9BQU8sTUFBTTs7S0FFZCxPQUFPLEtBQUs7OztJQUdiLE9BQU8sS0FBSyxtQkFBbUI7TUFDN0IsSUFBSSxLQUFLLGdCQUFnQjtNQUN6QixJQUFJLEtBQUs7TUFDVCxNQUFNLElBQUksS0FBSztNQUNmLElBQUksS0FBSztNQUNULElBQUksS0FBSzs7O0dBR1osV0FBVyxXQUFXOztJQUVyQixLQUFLLFlBQVksT0FBTyxFQUFFLE9BQU8sS0FBSyxXQUFXLElBQUk7SUFDckQsSUFBSSxPQUFPOztJQUVYLEVBQUUsS0FBSyxLQUFLLGdCQUFnQixTQUFTLE1BQU07S0FDMUMsSUFBSSxDQUFDLEVBQUUsWUFBWSxLQUFLLE1BQU0sVUFBVSxDQUFDLEVBQUUsWUFBWSxLQUFLLE1BQU0sTUFBTSxLQUFLOztNQUU1RSxLQUFLLFlBQVksTUFBTSxLQUFLLE1BQU0sTUFBTTs7OztJQUkxQyxLQUFLLFNBQVMsS0FBSzs7O0lBR25CLEtBQUssS0FBSyxjQUFjLFFBQVEsY0FBYyxLQUFLOzs7R0FHcEQsU0FBUyxTQUFTLFNBQVM7SUFDMUIsSUFBSSxFQUFFLFlBQVksWUFBWSxRQUFRLFdBQVcsR0FBRztLQUNuRCxPQUFPOztJQUVSLElBQUksUUFBUTtJQUNaLElBQUksZ0JBQWdCLENBQUMsTUFBTSxTQUFTLE9BQU8sU0FBUyxZQUFZLFFBQVEsT0FBTyxTQUFTLE9BQU8sUUFBUSxPQUFPLE9BQU8sVUFBVSxVQUFVO0tBQ3hJLElBQUksTUFBTSxNQUFNLFdBQVc7TUFDMUIsT0FBTyxNQUFNLE1BQU0sVUFBVSxPQUFPLFVBQVUsVUFBVTtPQUN2RCxJQUFJLENBQUMsU0FBUyxPQUFPO1FBQ3BCLE9BQU87O09BRVIsSUFBSSxFQUFFLFNBQVMsU0FBUyxRQUFRO1FBQy9CLE9BQU8sU0FBUyxNQUFNLGNBQWMsUUFBUSxRQUFRLG1CQUFtQixDQUFDOztPQUV6RSxJQUFJLEVBQUUsUUFBUSxTQUFTLFFBQVE7UUFDOUIsT0FBTyxTQUFTLE1BQU0sT0FBTyxTQUFTLEdBQUc7U0FDeEMsT0FBTyxFQUFFLGNBQWMsUUFBUSxRQUFRLG1CQUFtQixDQUFDO1dBQ3pELFNBQVM7O09BRWIsT0FBTztTQUNMLFNBQVM7O0tBRWIsT0FBTzs7SUFFUixPQUFPLGNBQWMsU0FBUzs7Ozs7RUFLaEMsR0FBRyxRQUFRLFVBQVUsUUFBUTtHQUM1QixRQUFRLE9BQU8sS0FBSyxNQUFNO0dBQzFCLFFBQVEsT0FBTyxLQUFLLE9BQU8sUUFBUSxjQUFjLEtBQUssS0FBSztTQUNyRDtHQUNOLFFBQVEsT0FBTyxLQUFLLE9BQU87SUFDMUIsU0FBUyxDQUFDLENBQUMsT0FBTztJQUNsQixJQUFJLENBQUMsQ0FBQyxPQUFPOztHQUVkLEtBQUssS0FBSyxjQUFjLFFBQVEsY0FBYyxLQUFLOzs7RUFHcEQsSUFBSSxXQUFXLEtBQUssWUFBWTtFQUNoQyxHQUFHLENBQUMsVUFBVTtHQUNiLEtBQUssV0FBVztTQUNWO0dBQ04sSUFBSSxRQUFRLFNBQVMsU0FBUyxRQUFRO0lBQ3JDLEtBQUssV0FBVyxDQUFDLFNBQVM7Ozs7O0FBSzlCO0FDaFRBLFFBQVEsT0FBTztDQUNkLFFBQVEsMEZBQXNCLFNBQVMsV0FBVyxZQUFZLGlCQUFpQixhQUFhLElBQUk7O0NBRWhHLElBQUksZUFBZTtDQUNuQixJQUFJLGNBQWM7O0NBRWxCLElBQUksVUFBVSxXQUFXO0VBQ3hCLElBQUksYUFBYSxTQUFTLEdBQUc7R0FDNUIsT0FBTyxHQUFHLEtBQUs7O0VBRWhCLElBQUksRUFBRSxZQUFZLGNBQWM7R0FDL0IsY0FBYyxXQUFXLEtBQUssU0FBUyxTQUFTO0lBQy9DLGNBQWM7SUFDZCxlQUFlLFFBQVEsYUFBYSxJQUFJLFNBQVMsYUFBYTtLQUM3RCxPQUFPLElBQUksWUFBWTs7OztFQUkxQixPQUFPOzs7Q0FHUixPQUFPO0VBQ04sUUFBUSxXQUFXO0dBQ2xCLE9BQU8sVUFBVSxLQUFLLFdBQVc7SUFDaEMsT0FBTzs7OztFQUlULFdBQVcsWUFBWTtHQUN0QixPQUFPLEtBQUssU0FBUyxLQUFLLFNBQVMsY0FBYztJQUNoRCxPQUFPLGFBQWEsSUFBSSxVQUFVLFNBQVM7S0FDMUMsT0FBTyxRQUFRO09BQ2IsT0FBTyxTQUFTLEdBQUcsR0FBRztLQUN4QixPQUFPLEVBQUUsT0FBTzs7Ozs7RUFLbkIsdUJBQXVCLFdBQVc7R0FDakMsT0FBTyxhQUFhOzs7RUFHckIsZ0JBQWdCLFNBQVMsYUFBYTtHQUNyQyxPQUFPLFdBQVcsS0FBSyxTQUFTLFNBQVM7SUFDeEMsT0FBTyxVQUFVLGVBQWUsQ0FBQyxZQUFZLGFBQWEsSUFBSSxRQUFRLFVBQVUsS0FBSyxTQUFTLGFBQWE7S0FDMUcsY0FBYyxJQUFJLFlBQVk7TUFDN0IsS0FBSyxZQUFZLEdBQUc7TUFDcEIsTUFBTSxZQUFZOztLQUVuQixZQUFZLGNBQWM7S0FDMUIsT0FBTzs7Ozs7RUFLVixRQUFRLFNBQVMsYUFBYTtHQUM3QixPQUFPLFdBQVcsS0FBSyxTQUFTLFNBQVM7SUFDeEMsT0FBTyxVQUFVLGtCQUFrQixDQUFDLFlBQVksYUFBYSxJQUFJLFFBQVE7Ozs7RUFJM0UsUUFBUSxTQUFTLGFBQWE7R0FDN0IsT0FBTyxXQUFXLEtBQUssV0FBVztJQUNqQyxPQUFPLFVBQVUsa0JBQWtCLGFBQWEsS0FBSyxXQUFXO0tBQy9ELElBQUksUUFBUSxhQUFhLFFBQVE7S0FDakMsYUFBYSxPQUFPLE9BQU87Ozs7O0VBSzlCLFFBQVEsU0FBUyxhQUFhLGFBQWE7R0FDMUMsT0FBTyxXQUFXLEtBQUssU0FBUyxTQUFTO0lBQ3hDLE9BQU8sVUFBVSxrQkFBa0IsYUFBYSxDQUFDLFlBQVksYUFBYSxJQUFJLFFBQVE7Ozs7RUFJeEYsS0FBSyxTQUFTLGFBQWE7R0FDMUIsT0FBTyxLQUFLLFNBQVMsS0FBSyxTQUFTLGNBQWM7SUFDaEQsT0FBTyxhQUFhLE9BQU8sVUFBVSxTQUFTO0tBQzdDLE9BQU8sUUFBUSxnQkFBZ0I7T0FDN0I7Ozs7RUFJTCxNQUFNLFNBQVMsYUFBYTtHQUMzQixPQUFPLFVBQVUsZ0JBQWdCOzs7RUFHbEMsT0FBTyxTQUFTLGFBQWEsV0FBVyxXQUFXLFVBQVUsZUFBZTtHQUMzRSxJQUFJLFNBQVMsU0FBUyxlQUFlLGVBQWUsSUFBSSxJQUFJO0dBQzVELElBQUksU0FBUyxPQUFPLGNBQWM7R0FDbEMsT0FBTyxhQUFhLFdBQVc7R0FDL0IsT0FBTyxhQUFhLFdBQVc7R0FDL0IsT0FBTyxZQUFZOztHQUVuQixJQUFJLE9BQU8sT0FBTyxjQUFjO0dBQ2hDLE9BQU8sWUFBWTs7R0FFbkIsSUFBSSxRQUFRLE9BQU8sY0FBYztHQUNqQyxJQUFJLGNBQWMsR0FBRyxNQUFNLGlCQUFpQjtJQUMzQyxNQUFNLGNBQWM7VUFDZCxJQUFJLGNBQWMsR0FBRyxNQUFNLGtCQUFrQjtJQUNuRCxNQUFNLGNBQWM7O0dBRXJCLE1BQU0sZUFBZTtHQUNyQixLQUFLLFlBQVk7O0dBRWpCLElBQUksV0FBVyxPQUFPLGNBQWM7R0FDcEMsU0FBUyxjQUFjLEVBQUUsWUFBWSxtQ0FBbUM7SUFDdkUsYUFBYSxZQUFZO0lBQ3pCLE9BQU8sWUFBWTs7R0FFcEIsS0FBSyxZQUFZOztHQUVqQixJQUFJLFVBQVU7SUFDYixJQUFJLE1BQU0sT0FBTyxjQUFjO0lBQy9CLEtBQUssWUFBWTs7O0dBR2xCLElBQUksT0FBTyxPQUFPOztHQUVsQixPQUFPLFVBQVUsSUFBSTtJQUNwQixJQUFJLFFBQVEsTUFBTSxDQUFDLFFBQVEsUUFBUSxNQUFNO0lBQ3pDLFlBQVk7S0FDWCxLQUFLLFNBQVMsVUFBVTtJQUN6QixJQUFJLFNBQVMsV0FBVyxLQUFLO0tBQzVCLElBQUksQ0FBQyxlQUFlO01BQ25CLElBQUksY0FBYyxHQUFHLE1BQU0saUJBQWlCO09BQzNDLFlBQVksV0FBVyxNQUFNLEtBQUs7UUFDakMsSUFBSTtRQUNKLGFBQWE7UUFDYixVQUFVOzthQUVMLElBQUksY0FBYyxHQUFHLE1BQU0sa0JBQWtCO09BQ25ELFlBQVksV0FBVyxPQUFPLEtBQUs7UUFDbEMsSUFBSTtRQUNKLGFBQWE7UUFDYixVQUFVOzs7Ozs7Ozs7RUFTaEIsU0FBUyxTQUFTLGFBQWEsV0FBVyxXQUFXO0dBQ3BELElBQUksU0FBUyxTQUFTLGVBQWUsZUFBZSxJQUFJLElBQUk7R0FDNUQsSUFBSSxTQUFTLE9BQU8sY0FBYztHQUNsQyxPQUFPLGFBQWEsV0FBVztHQUMvQixPQUFPLGFBQWEsV0FBVztHQUMvQixPQUFPLFlBQVk7O0dBRW5CLElBQUksVUFBVSxPQUFPLGNBQWM7R0FDbkMsT0FBTyxZQUFZOztHQUVuQixJQUFJLFFBQVEsT0FBTyxjQUFjO0dBQ2pDLElBQUksY0FBYyxHQUFHLE1BQU0saUJBQWlCO0lBQzNDLE1BQU0sY0FBYztVQUNkLElBQUksY0FBYyxHQUFHLE1BQU0sa0JBQWtCO0lBQ25ELE1BQU0sY0FBYzs7R0FFckIsTUFBTSxlQUFlO0dBQ3JCLFFBQVEsWUFBWTtHQUNwQixJQUFJLE9BQU8sT0FBTzs7O0dBR2xCLE9BQU8sVUFBVSxJQUFJO0lBQ3BCLElBQUksUUFBUSxNQUFNLENBQUMsUUFBUSxRQUFRLE1BQU07SUFDekMsWUFBWTtLQUNYLEtBQUssU0FBUyxVQUFVO0lBQ3pCLElBQUksU0FBUyxXQUFXLEtBQUs7S0FDNUIsSUFBSSxjQUFjLEdBQUcsTUFBTSxpQkFBaUI7TUFDM0MsWUFBWSxXQUFXLFFBQVEsWUFBWSxXQUFXLE1BQU0sT0FBTyxTQUFTLE1BQU07T0FDakYsT0FBTyxLQUFLLE9BQU87O1lBRWQsSUFBSSxjQUFjLEdBQUcsTUFBTSxrQkFBa0I7TUFDbkQsWUFBWSxXQUFXLFNBQVMsWUFBWSxXQUFXLE9BQU8sT0FBTyxTQUFTLFFBQVE7T0FDckYsT0FBTyxPQUFPLE9BQU87Ozs7S0FJdkIsT0FBTztXQUNEO0tBQ04sT0FBTzs7Ozs7Ozs7OztBQVVaO0FDbE1BLFFBQVEsT0FBTztDQUNkLFFBQVEsZ0dBQWtCLFNBQVMsV0FBVyxvQkFBb0IsU0FBUyxJQUFJLGNBQWMsT0FBTzs7Q0FFcEcsSUFBSSxjQUFjOztDQUVsQixJQUFJLFdBQVcsYUFBYTs7Q0FFNUIsSUFBSSxvQkFBb0I7O0NBRXhCLElBQUksY0FBYzs7Q0FFbEIsS0FBSywyQkFBMkIsU0FBUyxVQUFVO0VBQ2xELGtCQUFrQixLQUFLOzs7Q0FHeEIsSUFBSSxrQkFBa0IsU0FBUyxXQUFXLEtBQUs7RUFDOUMsSUFBSSxLQUFLO0dBQ1IsT0FBTztHQUNQLEtBQUs7R0FDTCxVQUFVLFNBQVM7O0VBRXBCLFFBQVEsUUFBUSxtQkFBbUIsU0FBUyxVQUFVO0dBQ3JELFNBQVM7Ozs7Q0FJWCxLQUFLLFlBQVksV0FBVztFQUMzQixJQUFJLEVBQUUsWUFBWSxjQUFjO0dBQy9CLGNBQWMsbUJBQW1CLFNBQVMsS0FBSyxVQUFVLHFCQUFxQjtJQUM3RSxJQUFJLFdBQVc7SUFDZixvQkFBb0IsUUFBUSxVQUFVLGFBQWE7S0FDbEQsU0FBUztNQUNSLG1CQUFtQixLQUFLLGFBQWEsS0FBSyxVQUFVLGFBQWE7T0FDaEUsS0FBSyxJQUFJLEtBQUssWUFBWSxTQUFTO1FBQ2xDLElBQUksWUFBWSxRQUFRLEdBQUcsYUFBYTtTQUN2QyxJQUFJLFVBQVUsSUFBSSxRQUFRLGFBQWEsWUFBWSxRQUFRO1NBQzNELFNBQVMsSUFBSSxRQUFRLE9BQU87ZUFDdEI7O1NBRU4sUUFBUSxJQUFJLCtCQUErQixZQUFZLFFBQVEsR0FBRzs7Ozs7O0lBTXZFLE9BQU8sR0FBRyxJQUFJLFVBQVUsS0FBSyxZQUFZO0tBQ3hDLGNBQWM7Ozs7RUFJakIsT0FBTzs7O0NBR1IsS0FBSyxTQUFTLFdBQVc7RUFDeEIsR0FBRyxnQkFBZ0IsT0FBTztHQUN6QixPQUFPLEtBQUssWUFBWSxLQUFLLFdBQVc7SUFDdkMsT0FBTyxTQUFTOztTQUVYO0dBQ04sT0FBTyxHQUFHLEtBQUssU0FBUzs7OztDQUkxQixLQUFLLFlBQVksWUFBWTtFQUM1QixPQUFPLEtBQUssU0FBUyxLQUFLLFNBQVMsVUFBVTtHQUM1QyxPQUFPLEVBQUUsS0FBSyxTQUFTLElBQUksVUFBVSxTQUFTO0lBQzdDLE9BQU8sUUFBUTtNQUNiLE9BQU8sU0FBUyxHQUFHLEdBQUc7SUFDeEIsT0FBTyxFQUFFLE9BQU87TUFDZCxJQUFJLFFBQVE7Ozs7Q0FJakIsS0FBSyxVQUFVLFNBQVMsS0FBSztFQUM1QixHQUFHLGdCQUFnQixPQUFPO0dBQ3pCLE9BQU8sS0FBSyxZQUFZLEtBQUssV0FBVztJQUN2QyxPQUFPLFNBQVMsSUFBSTs7U0FFZjtHQUNOLE9BQU8sR0FBRyxLQUFLLFNBQVMsSUFBSTs7OztDQUk5QixLQUFLLFNBQVMsU0FBUyxZQUFZLGFBQWEsS0FBSztFQUNwRCxjQUFjLGVBQWUsbUJBQW1CO0VBQ2hELGFBQWEsY0FBYyxJQUFJLFFBQVE7RUFDdkMsSUFBSSxTQUFTO0VBQ2IsR0FBRyxNQUFNLFNBQVMsTUFBTTtHQUN2QixTQUFTO1NBQ0g7R0FDTixTQUFTLE1BQU07O0VBRWhCLFdBQVcsSUFBSTtFQUNmLFdBQVcsT0FBTyxhQUFhO0VBQy9CLFdBQVcsZ0JBQWdCLFlBQVk7RUFDdkMsSUFBSSxFQUFFLFlBQVksV0FBVyxlQUFlLFdBQVcsZUFBZSxJQUFJO0dBQ3pFLFdBQVcsU0FBUyxFQUFFLFlBQVk7OztFQUduQyxPQUFPLFVBQVU7R0FDaEI7R0FDQTtJQUNDLE1BQU0sV0FBVyxLQUFLO0lBQ3RCLFVBQVUsU0FBUzs7SUFFbkIsS0FBSyxTQUFTLEtBQUs7R0FDcEIsV0FBVyxRQUFRLElBQUksa0JBQWtCO0dBQ3pDLFNBQVMsSUFBSSxRQUFRO0dBQ3JCLGdCQUFnQixVQUFVO0dBQzFCLE9BQU87S0FDTCxNQUFNLFNBQVMsS0FBSztHQUN0QixJQUFJLE1BQU0sRUFBRSxZQUFZO0dBQ3hCLElBQUksQ0FBQyxRQUFRLFlBQVksUUFBUSxDQUFDLFFBQVEsWUFBWSxJQUFJLGdCQUFnQixDQUFDLFFBQVEsWUFBWSxJQUFJLFlBQVksdUJBQXVCLDBCQUEwQixhQUFhO0lBQzVLLElBQUksRUFBRSxJQUFJLFlBQVksdUJBQXVCLDBCQUEwQixZQUFZLFFBQVE7S0FDMUYsTUFBTSxFQUFFLElBQUksWUFBWSx1QkFBdUIsMEJBQTBCLFlBQVk7Ozs7R0FJdkYsR0FBRyxhQUFhLGNBQWM7Ozs7Q0FJaEMsS0FBSyxTQUFTLFNBQVMsTUFBTSxNQUFNLGFBQWEsa0JBQWtCO0VBQ2pFLGNBQWMsZUFBZSxtQkFBbUI7O0VBRWhELElBQUksU0FBUztFQUNiLElBQUksZUFBZSxLQUFLLE1BQU07O0VBRTlCLElBQUksQ0FBQyxjQUFjO0dBQ2xCLEdBQUcsYUFBYSxjQUFjLEVBQUUsWUFBWTtHQUM1QyxJQUFJLGtCQUFrQjtJQUNyQixpQkFBaUI7O0dBRWxCOztFQUVELElBQUksTUFBTTtFQUNWLElBQUksSUFBSSxLQUFLLGNBQWM7R0FDMUIsSUFBSSxhQUFhLElBQUksUUFBUSxhQUFhLENBQUMsYUFBYSxhQUFhO0dBQ3JFLElBQUksQ0FBQyxPQUFPLE9BQU8sUUFBUSxXQUFXLGFBQWEsR0FBRztJQUNyRCxJQUFJLGtCQUFrQjtLQUNyQixpQkFBaUIsTUFBTSxhQUFhOztJQUVyQyxHQUFHLGFBQWEsY0FBYyxFQUFFLFlBQVk7SUFDNUM7SUFDQTs7R0FFRCxLQUFLLE9BQU8sWUFBWSxhQUFhLEtBQUssV0FBVzs7SUFFcEQsSUFBSSxrQkFBa0I7S0FDckIsaUJBQWlCLE1BQU0sYUFBYTs7SUFFckM7Ozs7O0NBS0gsS0FBSyxjQUFjLFVBQVUsU0FBUyxhQUFhO0VBQ2xELElBQUksUUFBUSxrQkFBa0IsWUFBWSxhQUFhO0dBQ3REOztFQUVELFFBQVE7RUFDUixJQUFJLFFBQVEsUUFBUSxLQUFLO0VBQ3pCLElBQUksTUFBTSxRQUFROzs7RUFHbEIsS0FBSyxPQUFPOzs7RUFHWixLQUFLLE9BQU8sT0FBTyxhQUFhOzs7Q0FHakMsS0FBSyxTQUFTLFNBQVMsU0FBUzs7RUFFL0IsUUFBUTs7O0VBR1IsT0FBTyxVQUFVLFdBQVcsUUFBUSxNQUFNLENBQUMsTUFBTSxPQUFPLEtBQUssU0FBUyxLQUFLO0dBQzFFLElBQUksVUFBVSxJQUFJLGtCQUFrQjtHQUNwQyxRQUFRLFFBQVE7R0FDaEIsZ0JBQWdCLFVBQVUsUUFBUTs7OztDQUlwQyxLQUFLLFNBQVMsU0FBUyxTQUFTOztFQUUvQixPQUFPLFVBQVUsV0FBVyxRQUFRLE1BQU0sS0FBSyxXQUFXO0dBQ3pELFNBQVMsT0FBTyxRQUFRO0dBQ3hCLGdCQUFnQixVQUFVLFFBQVE7Ozs7QUFJckM7QUMvTEEsUUFBUSxPQUFPO0NBQ2QsUUFBUSxhQUFhLFdBQVc7Q0FDaEMsSUFBSSxNQUFNLElBQUksSUFBSSxVQUFVO0VBQzNCLElBQUksSUFBSTs7Q0FFVCxPQUFPLElBQUksSUFBSSxPQUFPOztBQUV2QjtBQ1BBLFFBQVEsT0FBTztDQUNkLFFBQVEsNEJBQWMsU0FBUyxXQUFXO0NBQzFDLE9BQU8sVUFBVSxjQUFjO0VBQzlCLFFBQVEsR0FBRyxhQUFhO0VBQ3hCLGFBQWE7RUFDYixpQkFBaUI7OztBQUduQjtBQ1JBLFFBQVEsT0FBTztDQUNkLFFBQVEsaUJBQWlCLFdBQVc7Q0FDcEMsSUFBSSxhQUFhOztDQUVqQixJQUFJLG9CQUFvQjs7Q0FFeEIsS0FBSywyQkFBMkIsU0FBUyxVQUFVO0VBQ2xELGtCQUFrQixLQUFLOzs7Q0FHeEIsSUFBSSxrQkFBa0IsU0FBUyxXQUFXO0VBQ3pDLElBQUksS0FBSztHQUNSLE1BQU07R0FDTixXQUFXOztFQUVaLFFBQVEsUUFBUSxtQkFBbUIsU0FBUyxVQUFVO0dBQ3JELFNBQVM7Ozs7Q0FJWCxJQUFJLGNBQWM7RUFDakIsUUFBUSxTQUFTLFFBQVE7R0FDeEIsT0FBTyxVQUFVLFlBQVksS0FBSzs7RUFFbkMsYUFBYSxTQUFTLE9BQU87R0FDNUIsYUFBYTtHQUNiLGdCQUFnQjs7OztDQUlsQixLQUFLLGdCQUFnQixXQUFXO0VBQy9CLE9BQU87OztDQUdSLEtBQUssY0FBYyxXQUFXO0VBQzdCLElBQUksQ0FBQyxFQUFFLFlBQVksRUFBRSxnQkFBZ0I7R0FDcEMsRUFBRSxjQUFjLEdBQUc7O0VBRXBCLGFBQWE7OztDQUdkLElBQUksQ0FBQyxFQUFFLFlBQVksR0FBRyxVQUFVO0VBQy9CLEdBQUcsUUFBUSxTQUFTLGNBQWM7RUFDbEMsSUFBSSxDQUFDLEVBQUUsWUFBWSxJQUFJLFNBQVM7R0FDL0IsR0FBRyxTQUFTLElBQUksSUFBSSxPQUFPLEVBQUUsZUFBZSxFQUFFO0dBQzlDLEVBQUUsY0FBYzs7OztDQUlsQixJQUFJLENBQUMsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCO0VBQ3BDLEVBQUUsY0FBYyxHQUFHLGlCQUFpQixZQUFZLFNBQVMsR0FBRztHQUMzRCxHQUFHLEVBQUUsWUFBWSxJQUFJO0lBQ3BCLGdCQUFnQjs7Ozs7QUFLcEI7QUN6REEsUUFBUSxPQUFPO0NBQ2QsUUFBUSxtQkFBbUIsV0FBVztDQUN0QyxJQUFJLFdBQVc7RUFDZCxjQUFjO0dBQ2I7Ozs7Q0FJRixLQUFLLE1BQU0sU0FBUyxLQUFLLE9BQU87RUFDL0IsU0FBUyxPQUFPOzs7Q0FHakIsS0FBSyxNQUFNLFNBQVMsS0FBSztFQUN4QixPQUFPLFNBQVM7OztDQUdqQixLQUFLLFNBQVMsV0FBVztFQUN4QixPQUFPOzs7QUFHVDtBQ3BCQSxRQUFRLE9BQU87Q0FDZCxRQUFRLDBCQUEwQixXQUFXOzs7Ozs7Ozs7OztDQVc3QyxLQUFLLFlBQVk7RUFDaEIsVUFBVTtHQUNULGNBQWMsRUFBRSxZQUFZO0dBQzVCLFVBQVU7O0VBRVgsR0FBRztHQUNGLGNBQWMsRUFBRSxZQUFZO0dBQzVCLGNBQWM7SUFDYixNQUFNLENBQUMsSUFBSSxJQUFJLElBQUksSUFBSTs7R0FFeEIsVUFBVTs7RUFFWCxNQUFNO0dBQ0wsY0FBYyxFQUFFLFlBQVk7R0FDNUIsVUFBVTs7RUFFWCxLQUFLO0dBQ0osVUFBVTtHQUNWLGNBQWMsRUFBRSxZQUFZO0dBQzVCLFVBQVU7O0VBRVgsT0FBTztHQUNOLFVBQVU7R0FDVixjQUFjLEVBQUUsWUFBWTtHQUM1QixVQUFVO0dBQ1YsY0FBYztJQUNiLE1BQU0sQ0FBQztJQUNQLEtBQUssQ0FBQyxLQUFLLENBQUM7O0dBRWIsU0FBUztJQUNSLENBQUMsSUFBSSxRQUFRLE1BQU0sRUFBRSxZQUFZO0lBQ2pDLENBQUMsSUFBSSxRQUFRLE1BQU0sRUFBRSxZQUFZO0lBQ2pDLENBQUMsSUFBSSxTQUFTLE1BQU0sRUFBRSxZQUFZOztFQUVwQyxLQUFLO0dBQ0osVUFBVTtHQUNWLGNBQWMsRUFBRSxZQUFZO0dBQzVCLFVBQVU7R0FDVixjQUFjO0lBQ2IsTUFBTSxDQUFDLElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJO0lBQy9CLEtBQUssQ0FBQyxLQUFLLENBQUM7O0dBRWIsU0FBUztJQUNSLENBQUMsSUFBSSxRQUFRLE1BQU0sRUFBRSxZQUFZO0lBQ2pDLENBQUMsSUFBSSxRQUFRLE1BQU0sRUFBRSxZQUFZO0lBQ2pDLENBQUMsSUFBSSxTQUFTLE1BQU0sRUFBRSxZQUFZOzs7RUFHcEMsWUFBWTtHQUNYLGNBQWMsRUFBRSxZQUFZO0dBQzVCLFVBQVU7O0VBRVgsTUFBTTtHQUNMLGNBQWMsRUFBRSxZQUFZO0dBQzVCLFVBQVU7O0VBRVgsYUFBYTtHQUNaLGNBQWMsRUFBRSxZQUFZO0dBQzVCLFVBQVU7O0VBRVgsV0FBVztHQUNWLGNBQWMsRUFBRSxZQUFZO0dBQzVCLFVBQVU7O0VBRVgsT0FBTztHQUNOLFVBQVU7R0FDVixjQUFjLEVBQUUsWUFBWTtHQUM1QixVQUFVO0dBQ1YsY0FBYztJQUNiLE1BQU07SUFDTixLQUFLLENBQUMsS0FBSyxDQUFDOztHQUViLFNBQVM7SUFDUixDQUFDLElBQUksUUFBUSxNQUFNLEVBQUUsWUFBWTtJQUNqQyxDQUFDLElBQUksUUFBUSxNQUFNLEVBQUUsWUFBWTtJQUNqQyxDQUFDLElBQUksU0FBUyxNQUFNLEVBQUUsWUFBWTs7O0VBR3BDLE1BQU07R0FDTCxVQUFVO0dBQ1YsY0FBYyxFQUFFLFlBQVk7R0FDNUIsVUFBVTtHQUNWLGNBQWM7SUFDYixNQUFNLENBQUM7SUFDUCxLQUFLLENBQUMsS0FBSyxDQUFDOztHQUViLFNBQVM7SUFDUixDQUFDLElBQUksUUFBUSxNQUFNLEVBQUUsWUFBWTtJQUNqQyxDQUFDLElBQUksUUFBUSxNQUFNLEVBQUUsWUFBWTtJQUNqQyxDQUFDLElBQUksU0FBUyxNQUFNLEVBQUUsWUFBWTs7O0VBR3BDLEtBQUs7R0FDSixVQUFVO0dBQ1YsY0FBYyxFQUFFLFlBQVk7R0FDNUIsVUFBVTtHQUNWLGNBQWM7SUFDYixNQUFNLENBQUM7SUFDUCxLQUFLLENBQUMsS0FBSyxDQUFDOztHQUViLFNBQVM7SUFDUixDQUFDLElBQUksY0FBYyxNQUFNLEVBQUUsWUFBWTtJQUN2QyxDQUFDLElBQUksY0FBYyxNQUFNLEVBQUUsWUFBWTtJQUN2QyxDQUFDLElBQUksUUFBUSxNQUFNLEVBQUUsWUFBWTtJQUNqQyxDQUFDLElBQUksT0FBTyxNQUFNLEVBQUUsWUFBWTtJQUNoQyxDQUFDLElBQUksWUFBWSxNQUFNLEVBQUUsWUFBWTtJQUNyQyxDQUFDLElBQUksWUFBWSxNQUFNLEVBQUUsWUFBWTtJQUNyQyxDQUFDLElBQUksU0FBUyxNQUFNLEVBQUUsWUFBWTtJQUNsQyxDQUFDLElBQUksU0FBUyxNQUFNLEVBQUUsWUFBWTs7O0VBR3BDLG1CQUFtQjtHQUNsQixVQUFVO0dBQ1YsY0FBYyxFQUFFLFlBQVk7R0FDNUIsVUFBVTtHQUNWLGNBQWM7SUFDYixNQUFNLENBQUM7SUFDUCxLQUFLLENBQUMsS0FBSyxDQUFDOztHQUViLFNBQVM7SUFDUixDQUFDLElBQUksWUFBWSxNQUFNO0lBQ3ZCLENBQUMsSUFBSSxXQUFXLE1BQU07Ozs7OztDQU16QixLQUFLLGFBQWE7RUFDakI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOzs7Q0FHRCxLQUFLLG1CQUFtQjtDQUN4QixLQUFLLElBQUksUUFBUSxLQUFLLFdBQVc7RUFDaEMsS0FBSyxpQkFBaUIsS0FBSyxDQUFDLElBQUksTUFBTSxNQUFNLEtBQUssVUFBVSxNQUFNLGNBQWMsVUFBVSxDQUFDLENBQUMsS0FBSyxVQUFVLE1BQU07OztDQUdqSCxLQUFLLGVBQWUsU0FBUyxVQUFVO0VBQ3RDLFNBQVMsV0FBVyxRQUFRLEVBQUUsT0FBTyxPQUFPLE9BQU8sR0FBRyxnQkFBZ0IsT0FBTyxNQUFNO0VBQ25GLE9BQU87R0FDTixNQUFNLGFBQWE7R0FDbkIsY0FBYyxXQUFXO0dBQ3pCLFVBQVU7R0FDVixXQUFXOzs7O0NBSWIsS0FBSyxVQUFVLFNBQVMsVUFBVTtFQUNqQyxPQUFPLEtBQUssVUFBVSxhQUFhLEtBQUssYUFBYTs7OztBQUl2RDtBQ2pMQSxRQUFRLE9BQU87Q0FDZCxPQUFPLGNBQWMsV0FBVztDQUNoQyxPQUFPLFNBQVMsT0FBTztFQUN0QixPQUFPLE1BQU0sU0FBUzs7O0FBR3hCO0FDTkEsUUFBUSxPQUFPO0NBQ2QsT0FBTyxnQkFBZ0IsV0FBVztDQUNsQyxPQUFPLFNBQVMsT0FBTzs7RUFFdEIsR0FBRyxPQUFPLE1BQU0sVUFBVSxZQUFZO0dBQ3JDLElBQUksTUFBTSxNQUFNO0dBQ2hCLE9BQU8sT0FBTyxJQUFJLEdBQUcsS0FBSyxJQUFJLEdBQUcsTUFBTSxJQUFJLEdBQUc7U0FDeEM7OztHQUdOLElBQUksT0FBTyxJQUFJLE9BQU8sVUFBVSxHQUFHO0lBQ2xDLFdBQVcsU0FBUyxRQUFRO0lBQzVCLE1BQU0sU0FBUyxNQUFNLE1BQU0sV0FBVztHQUN2QyxPQUFPLFNBQVMsTUFBTTs7O0dBR3RCO0FDaEJILFFBQVEsT0FBTztDQUNkLE9BQU8sc0JBQXNCLFdBQVc7Q0FDeEM7Q0FDQSxPQUFPLFVBQVUsVUFBVSxPQUFPO0VBQ2pDLElBQUksT0FBTyxhQUFhLGFBQWE7R0FDcEMsT0FBTzs7RUFFUixJQUFJLE9BQU8sVUFBVSxlQUFlLE1BQU0sa0JBQWtCLEVBQUUsWUFBWSxnQkFBZ0IsZUFBZTtHQUN4RyxPQUFPOztFQUVSLElBQUksU0FBUztFQUNiLElBQUksU0FBUyxTQUFTLEdBQUc7R0FDeEIsS0FBSyxJQUFJLElBQUksR0FBRyxJQUFJLFNBQVMsUUFBUSxLQUFLO0lBQ3pDLElBQUksTUFBTSxrQkFBa0IsRUFBRSxZQUFZLGVBQWUsZUFBZTtLQUN2RSxJQUFJLFNBQVMsR0FBRyxhQUFhLFdBQVcsR0FBRztNQUMxQyxPQUFPLEtBQUssU0FBUzs7V0FFaEI7S0FDTixJQUFJLFNBQVMsR0FBRyxhQUFhLFFBQVEsVUFBVSxHQUFHO01BQ2pELE9BQU8sS0FBSyxTQUFTOzs7OztFQUt6QixPQUFPOzs7QUFHVDtBQzNCQSxRQUFRLE9BQU87Q0FDZCxPQUFPLGVBQWUsV0FBVztDQUNqQztDQUNBLE9BQU8sVUFBVSxRQUFRLFNBQVM7RUFDakMsSUFBSSxPQUFPLFdBQVcsYUFBYTtHQUNsQyxPQUFPOztFQUVSLElBQUksT0FBTyxZQUFZLGFBQWE7R0FDbkMsT0FBTzs7RUFFUixJQUFJLFNBQVM7RUFDYixJQUFJLE9BQU8sU0FBUyxHQUFHO0dBQ3RCLEtBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxPQUFPLFFBQVEsS0FBSztJQUN2QyxJQUFJLE9BQU8sR0FBRyxXQUFXO0tBQ3hCLE9BQU8sS0FBSyxPQUFPO0tBQ25COztJQUVELElBQUksRUFBRSxZQUFZLFFBQVEsWUFBWSxPQUFPLEdBQUcsTUFBTTtLQUNyRCxPQUFPLEtBQUssT0FBTzs7OztFQUl0QixPQUFPOzs7QUFHVDtBQ3pCQSxRQUFRLE9BQU87Q0FDZCxPQUFPLGtCQUFrQixXQUFXO0NBQ3BDLE9BQU8sU0FBUyxPQUFPO0VBQ3RCLE9BQU8sTUFBTSxPQUFPOzs7QUFHdEI7QUNOQSxRQUFRLE9BQU87Q0FDZCxPQUFPLGlCQUFpQixDQUFDLFlBQVk7Q0FDckMsT0FBTyxVQUFVLE9BQU8sZUFBZSxjQUFjO0VBQ3BELElBQUksQ0FBQyxNQUFNLFFBQVEsUUFBUSxPQUFPO0VBQ2xDLElBQUksQ0FBQyxlQUFlLE9BQU87O0VBRTNCLElBQUksWUFBWTtFQUNoQixRQUFRLFFBQVEsT0FBTyxVQUFVLE1BQU07R0FDdEMsVUFBVSxLQUFLOzs7RUFHaEIsVUFBVSxLQUFLLFVBQVUsR0FBRyxHQUFHO0dBQzlCLElBQUksU0FBUyxFQUFFO0dBQ2YsSUFBSSxRQUFRLFdBQVcsU0FBUztJQUMvQixTQUFTLEVBQUU7O0dBRVosSUFBSSxTQUFTLEVBQUU7R0FDZixJQUFJLFFBQVEsV0FBVyxTQUFTO0lBQy9CLFNBQVMsRUFBRTs7O0dBR1osSUFBSSxRQUFRLFNBQVMsU0FBUztJQUM3QixPQUFPLENBQUMsZUFBZSxPQUFPLGNBQWMsVUFBVSxPQUFPLGNBQWM7OztHQUc1RSxJQUFJLFFBQVEsU0FBUyxXQUFXLFFBQVEsVUFBVSxTQUFTO0lBQzFELE9BQU8sQ0FBQyxlQUFlLFNBQVMsU0FBUyxTQUFTOzs7R0FHbkQsT0FBTzs7O0VBR1IsT0FBTzs7OztBQUlUO0FDcENBLFFBQVEsT0FBTztDQUNkLE9BQU8sY0FBYyxXQUFXO0NBQ2hDLE9BQU8sU0FBUyxPQUFPO0VBQ3RCLE9BQU8sVUFBVSxLQUFLLFFBQVEsRUFBRSxZQUFZOzs7QUFHOUM7QUNOQSxRQUFRLE9BQU87Q0FDZCxPQUFPLCtDQUFvQixTQUFTLHdCQUF3QjtDQUM1RDtDQUNBLE9BQU8sU0FBUyxPQUFPLE9BQU8sU0FBUzs7RUFFdEMsSUFBSSxXQUFXO0VBQ2YsUUFBUSxRQUFRLE9BQU8sU0FBUyxNQUFNO0dBQ3JDLFNBQVMsS0FBSzs7O0VBR2YsSUFBSSxhQUFhLFFBQVEsS0FBSyx1QkFBdUI7O0VBRXJELFdBQVc7O0VBRVgsU0FBUyxLQUFLLFVBQVUsR0FBRyxHQUFHO0dBQzdCLEdBQUcsV0FBVyxRQUFRLEVBQUUsVUFBVSxXQUFXLFFBQVEsRUFBRSxTQUFTO0lBQy9ELE9BQU87O0dBRVIsR0FBRyxXQUFXLFFBQVEsRUFBRSxVQUFVLFdBQVcsUUFBUSxFQUFFLFNBQVM7SUFDL0QsT0FBTyxDQUFDOztHQUVULE9BQU87OztFQUdSLEdBQUcsU0FBUyxTQUFTO0VBQ3JCLE9BQU87OztBQUdUO0FDNUJBLFFBQVEsT0FBTztDQUNkLE9BQU8sV0FBVyxXQUFXO0NBQzdCLE9BQU8sU0FBUyxLQUFLO0VBQ3BCLElBQUksRUFBRSxlQUFlLFNBQVMsT0FBTztFQUNyQyxPQUFPLEVBQUUsSUFBSSxLQUFLLFNBQVMsS0FBSyxLQUFLO0dBQ3BDLE9BQU8sT0FBTyxlQUFlLEtBQUssUUFBUSxDQUFDLE9BQU87Ozs7QUFJckQ7QUNUQSxRQUFRLE9BQU87Q0FDZCxPQUFPLGNBQWMsV0FBVztDQUNoQyxPQUFPLFNBQVMsT0FBTztFQUN0QixPQUFPLE1BQU0sTUFBTTs7O0FBR3JCIiwiZmlsZSI6InNjcmlwdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogb3duQ2xvdWQgLSBjb250YWN0c1xuICpcbiAqIFRoaXMgZmlsZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgdmVyc2lvbiAzIG9yXG4gKiBsYXRlci4gU2VlIHRoZSBDT1BZSU5HIGZpbGUuXG4gKlxuICogQGF1dGhvciBIZW5kcmlrIExlcHBlbHNhY2sgPGhlbmRyaWtAbGVwcGVsc2Fjay5kZT5cbiAqIEBjb3B5cmlnaHQgSGVuZHJpayBMZXBwZWxzYWNrIDIwMTVcbiAqL1xuXG5hbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnLCBbJ3V1aWQ0JywgJ2FuZ3VsYXItY2FjaGUnLCAnbmdSb3V0ZScsICd1aS5ib290c3RyYXAnLCAndWkuc2VsZWN0JywgJ25nU2FuaXRpemUnLCAnbmdjbGlwYm9hcmQnXSlcbi5jb25maWcoZnVuY3Rpb24oJHJvdXRlUHJvdmlkZXIpIHtcblxuXHQkcm91dGVQcm92aWRlci53aGVuKCcvOmdpZCcsIHtcblx0XHR0ZW1wbGF0ZTogJzxjb250YWN0ZGV0YWlscz48L2NvbnRhY3RkZXRhaWxzPidcblx0fSk7XG5cblx0JHJvdXRlUHJvdmlkZXIud2hlbignLzpnaWQvOnVpZCcsIHtcblx0XHR0ZW1wbGF0ZTogJzxjb250YWN0ZGV0YWlscz48L2NvbnRhY3RkZXRhaWxzPidcblx0fSk7XG5cblx0JHJvdXRlUHJvdmlkZXIub3RoZXJ3aXNlKCcvJyArIHQoJ2NvbnRhY3RzJywgJ0FsbCBjb250YWN0cycpKTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZGF0ZXBpY2tlcicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0cmVxdWlyZSA6ICduZ01vZGVsJyxcblx0XHRsaW5rIDogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRycywgbmdNb2RlbEN0cmwpIHtcblx0XHRcdCQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGVsZW1lbnQuZGF0ZXBpY2tlcih7XG5cdFx0XHRcdFx0ZGF0ZUZvcm1hdDoneXktbW0tZGQnLFxuXHRcdFx0XHRcdG1pbkRhdGU6IG51bGwsXG5cdFx0XHRcdFx0bWF4RGF0ZTogbnVsbCxcblx0XHRcdFx0XHRvblNlbGVjdDpmdW5jdGlvbiAoZGF0ZSkge1xuXHRcdFx0XHRcdFx0bmdNb2RlbEN0cmwuJHNldFZpZXdWYWx1ZShkYXRlKTtcblx0XHRcdFx0XHRcdHNjb3BlLiRhcHBseSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdmb2N1c0V4cHJlc3Npb24nLCBmdW5jdGlvbiAoJHRpbWVvdXQpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdGxpbms6IHtcblx0XHRcdHBvc3Q6IGZ1bmN0aW9uIHBvc3RMaW5rKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuXHRcdFx0XHRzY29wZS4kd2F0Y2goYXR0cnMuZm9jdXNFeHByZXNzaW9uLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKGF0dHJzLmZvY3VzRXhwcmVzc2lvbikge1xuXHRcdFx0XHRcdFx0aWYgKHNjb3BlLiRldmFsKGF0dHJzLmZvY3VzRXhwcmVzc2lvbikpIHtcblx0XHRcdFx0XHRcdFx0JHRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChlbGVtZW50LmlzKCdpbnB1dCcpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRlbGVtZW50LmZvY3VzKCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdGVsZW1lbnQuZmluZCgnaW5wdXQnKS5mb2N1cygpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSwgMTAwKTsgLy9uZWVkIHNvbWUgZGVsYXkgdG8gd29yayB3aXRoIG5nLWRpc2FibGVkXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdpbnB1dHJlc2l6ZScsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0bGluayA6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCkge1xuXHRcdFx0dmFyIGVsSW5wdXQgPSBlbGVtZW50LnZhbCgpO1xuXHRcdFx0ZWxlbWVudC5iaW5kKCdrZXlkb3duIGtleXVwIGxvYWQgZm9jdXMnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0ZWxJbnB1dCA9IGVsZW1lbnQudmFsKCk7XG5cdFx0XHRcdC8vIElmIHNldCB0byAwLCB0aGUgbWluLXdpZHRoIGNzcyBkYXRhIGlzIGlnbm9yZWRcblx0XHRcdFx0dmFyIGxlbmd0aCA9IGVsSW5wdXQubGVuZ3RoID4gMSA/IGVsSW5wdXQubGVuZ3RoIDogMTtcblx0XHRcdFx0ZWxlbWVudC5hdHRyKCdzaXplJywgbGVuZ3RoKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdhZGRyZXNzYm9va0N0cmwnLCBmdW5jdGlvbigkc2NvcGUsIEFkZHJlc3NCb29rU2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC50ID0ge1xuXHRcdGNvcHlVcmxUaXRsZSA6IHQoJ2NvbnRhY3RzJywgJ0NvcHkgVXJsIHRvIGNsaXBib2FyZCcpLFxuXHRcdGRvd25sb2FkOiB0KCdjb250YWN0cycsICdEb3dubG9hZCcpLFxuXHRcdHNob3dVUkw6dCgnY29udGFjdHMnLCAnU2hvd1VSTCcpLFxuXHRcdHNoYXJlQWRkcmVzc2Jvb2s6IHQoJ2NvbnRhY3RzJywgJ1NoYXJlIEFkZHJlc3Nib29rJyksXG5cdFx0ZGVsZXRlQWRkcmVzc2Jvb2s6IHQoJ2NvbnRhY3RzJywgJ0RlbGV0ZSBBZGRyZXNzYm9vaycpLFxuXHRcdHNoYXJlSW5wdXRQbGFjZUhvbGRlcjogdCgnY29udGFjdHMnLCAnU2hhcmUgd2l0aCB1c2VycyBvciBncm91cHMnKSxcblx0XHRkZWxldGU6IHQoJ2NvbnRhY3RzJywgJ0RlbGV0ZScpLFxuXHRcdGNhbkVkaXQ6IHQoJ2NvbnRhY3RzJywgJ2NhbiBlZGl0Jylcblx0fTtcblxuXHRjdHJsLnNob3dVcmwgPSBmYWxzZTtcblx0LyogZ2xvYmFscyBvY19jb25maWcgKi9cblx0LyogZXNsaW50LWRpc2FibGUgY2FtZWxjYXNlICovXG5cdGN0cmwuY2FuRXhwb3J0ID0gb2NfY29uZmlnLnZlcnNpb24uc3BsaXQoJy4nKSA+PSBbOSwgMCwgMiwgMF07XG5cdC8qIGVzbGludC1lbmFibGUgY2FtZWxjYXNlICovXG5cblx0Y3RybC50b2dnbGVTaG93VXJsID0gZnVuY3Rpb24oKSB7XG5cdFx0Y3RybC5zaG93VXJsID0gIWN0cmwuc2hvd1VybDtcblx0fTtcblxuXHRjdHJsLnRvZ2dsZVNoYXJlc0VkaXRvciA9IGZ1bmN0aW9uKCkge1xuXHRcdGN0cmwuZWRpdGluZ1NoYXJlcyA9ICFjdHJsLmVkaXRpbmdTaGFyZXM7XG5cdFx0Y3RybC5zZWxlY3RlZFNoYXJlZSA9IG51bGw7XG5cdH07XG5cblx0LyogRnJvbSBDYWxlbmRhci1SZXdvcmsgLSBqcy9hcHAvY29udHJvbGxlcnMvY2FsZW5kYXJsaXN0Y29udHJvbGxlci5qcyAqL1xuXHRjdHJsLmZpbmRTaGFyZWUgPSBmdW5jdGlvbiAodmFsKSB7XG5cdFx0cmV0dXJuICQuZ2V0KFxuXHRcdFx0T0MubGlua1RvT0NTKCdhcHBzL2ZpbGVzX3NoYXJpbmcvYXBpL3YxJykgKyAnc2hhcmVlcycsXG5cdFx0XHR7XG5cdFx0XHRcdGZvcm1hdDogJ2pzb24nLFxuXHRcdFx0XHRzZWFyY2g6IHZhbC50cmltKCksXG5cdFx0XHRcdHBlclBhZ2U6IDIwMCxcblx0XHRcdFx0aXRlbVR5cGU6ICdwcmluY2lwYWxzJ1xuXHRcdFx0fVxuXHRcdCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdC8vIFRvZG8gLSBmaWx0ZXIgb3V0IGN1cnJlbnQgdXNlciwgZXhpc3Rpbmcgc2hhcmVlc1xuXHRcdFx0dmFyIHVzZXJzICAgPSByZXN1bHQub2NzLmRhdGEuZXhhY3QudXNlcnMuY29uY2F0KHJlc3VsdC5vY3MuZGF0YS51c2Vycyk7XG5cdFx0XHR2YXIgZ3JvdXBzICA9IHJlc3VsdC5vY3MuZGF0YS5leGFjdC5ncm91cHMuY29uY2F0KHJlc3VsdC5vY3MuZGF0YS5ncm91cHMpO1xuXG5cdFx0XHR2YXIgdXNlclNoYXJlcyA9IGN0cmwuYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2Vycztcblx0XHRcdHZhciB1c2VyU2hhcmVzTGVuZ3RoID0gdXNlclNoYXJlcy5sZW5ndGg7XG5cdFx0XHR2YXIgaSwgajtcblxuXHRcdFx0Ly8gRmlsdGVyIG91dCBjdXJyZW50IHVzZXJcblx0XHRcdHZhciB1c2Vyc0xlbmd0aCA9IHVzZXJzLmxlbmd0aDtcblx0XHRcdGZvciAoaSA9IDAgOyBpIDwgdXNlcnNMZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodXNlcnNbaV0udmFsdWUuc2hhcmVXaXRoID09PSBPQy5jdXJyZW50VXNlcikge1xuXHRcdFx0XHRcdHVzZXJzLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBOb3cgZmlsdGVyIG91dCBhbGwgc2hhcmVlcyB0aGF0IGFyZSBhbHJlYWR5IHNoYXJlZCB3aXRoXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgdXNlclNoYXJlc0xlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHZhciBzaGFyZSA9IHVzZXJTaGFyZXNbaV07XG5cdFx0XHRcdHVzZXJzTGVuZ3RoID0gdXNlcnMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKGogPSAwOyBqIDwgdXNlcnNMZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdGlmICh1c2Vyc1tqXS52YWx1ZS5zaGFyZVdpdGggPT09IHNoYXJlLmlkKSB7XG5cdFx0XHRcdFx0XHR1c2Vycy5zcGxpY2UoaiwgMSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gQ29tYmluZSB1c2VycyBhbmQgZ3JvdXBzXG5cdFx0XHR1c2VycyA9IHVzZXJzLm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZGlzcGxheTogaXRlbS52YWx1ZS5zaGFyZVdpdGgsXG5cdFx0XHRcdFx0dHlwZTogT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSLFxuXHRcdFx0XHRcdGlkZW50aWZpZXI6IGl0ZW0udmFsdWUuc2hhcmVXaXRoXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblxuXHRcdFx0Z3JvdXBzID0gZ3JvdXBzLm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZGlzcGxheTogaXRlbS52YWx1ZS5zaGFyZVdpdGggKyAnIChncm91cCknLFxuXHRcdFx0XHRcdHR5cGU6IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVAsXG5cdFx0XHRcdFx0aWRlbnRpZmllcjogaXRlbS52YWx1ZS5zaGFyZVdpdGhcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gZ3JvdXBzLmNvbmNhdCh1c2Vycyk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC5vblNlbGVjdFNoYXJlZSA9IGZ1bmN0aW9uIChpdGVtKSB7XG5cdFx0Y3RybC5zZWxlY3RlZFNoYXJlZSA9IG51bGw7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIGl0ZW0udHlwZSwgaXRlbS5pZGVudGlmaWVyLCBmYWxzZSwgZmFsc2UpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cblx0fTtcblxuXHRjdHJsLnVwZGF0ZUV4aXN0aW5nVXNlclNoYXJlID0gZnVuY3Rpb24odXNlcklkLCB3cml0YWJsZSkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIsIHVzZXJJZCwgd3JpdGFibGUsIHRydWUpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVFeGlzdGluZ0dyb3VwU2hhcmUgPSBmdW5jdGlvbihncm91cElkLCB3cml0YWJsZSkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQLCBncm91cElkLCB3cml0YWJsZSwgdHJ1ZSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVuc2hhcmVGcm9tVXNlciA9IGZ1bmN0aW9uKHVzZXJJZCkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS51bnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUiwgdXNlcklkKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwudW5zaGFyZUZyb21Hcm91cCA9IGZ1bmN0aW9uKGdyb3VwSWQpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2UudW5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQLCBncm91cElkKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwuZGVsZXRlQWRkcmVzc0Jvb2sgPSBmdW5jdGlvbigpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2UuZGVsZXRlKGN0cmwuYWRkcmVzc0Jvb2spLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2FkZHJlc3Nib29rJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge1xuXHRcdFx0aW5kZXg6ICdAJ1xuXHRcdH0sXG5cdFx0Y29udHJvbGxlcjogJ2FkZHJlc3Nib29rQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0YWRkcmVzc0Jvb2s6ICc9ZGF0YScsXG5cdFx0XHRsaXN0OiAnPSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9hZGRyZXNzQm9vay5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdhZGRyZXNzYm9va2xpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBBZGRyZXNzQm9va1NlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwubG9hZGluZyA9IHRydWU7XG5cblx0QWRkcmVzc0Jvb2tTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0Y3RybC5hZGRyZXNzQm9va3MgPSBhZGRyZXNzQm9va3M7XG5cdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdH0pO1xuXG5cdGN0cmwudCA9IHtcblx0XHRhZGRyZXNzQm9va05hbWUgOiB0KCdjb250YWN0cycsICdBZGRyZXNzIGJvb2sgbmFtZScpXG5cdH07XG5cblx0Y3RybC5jcmVhdGVBZGRyZXNzQm9vayA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmKGN0cmwubmV3QWRkcmVzc0Jvb2tOYW1lKSB7XG5cdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuY3JlYXRlKGN0cmwubmV3QWRkcmVzc0Jvb2tOYW1lKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWRkcmVzc0Jvb2soY3RybC5uZXdBZGRyZXNzQm9va05hbWUpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRjdHJsLmFkZHJlc3NCb29rcy5wdXNoKGFkZHJlc3NCb29rKTtcblx0XHRcdFx0XHRjdHJsLm5ld0FkZHJlc3NCb29rTmFtZSA9ICcnO1xuXHRcdFx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdhZGRyZXNzYm9va2xpc3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0VBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2FkZHJlc3Nib29rbGlzdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9hZGRyZXNzQm9va0xpc3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignYXZhdGFyQ3RybCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmltcG9ydCA9IENvbnRhY3RTZXJ2aWNlLmltcG9ydC5iaW5kKENvbnRhY3RTZXJ2aWNlKTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYXZhdGFyJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge1xuXHRcdFx0Y29udGFjdDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQpIHtcblx0XHRcdHZhciBpbXBvcnRUZXh0ID0gdCgnY29udGFjdHMnLCAnSW1wb3J0Jyk7XG5cdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gaW1wb3J0VGV4dDtcblxuXHRcdFx0dmFyIGlucHV0ID0gZWxlbWVudC5maW5kKCdpbnB1dCcpO1xuXHRcdFx0aW5wdXQuYmluZCgnY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmaWxlID0gaW5wdXQuZ2V0KDApLmZpbGVzWzBdO1xuXHRcdFx0XHRpZiAoZmlsZS5zaXplID4gMTAyNCoxMDI0KSB7IC8vIDEgTUJcblx0XHRcdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdUaGUgc2VsZWN0ZWQgaW1hZ2UgaXMgdG9vIGJpZyAobWF4IDFNQiknKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0XHRcdFx0XHRyZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0c2NvcGUuY29udGFjdC5waG90byhyZWFkZXIucmVzdWx0KTtcblx0XHRcdFx0XHRcdFx0Q29udGFjdFNlcnZpY2UudXBkYXRlKHNjb3BlLmNvbnRhY3QpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSwgZmFsc2UpO1xuXG5cdFx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRcdHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvYXZhdGFyLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RDdHJsJywgZnVuY3Rpb24oJHJvdXRlLCAkcm91dGVQYXJhbXMpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwub3BlbkNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdHVpZDogY3RybC5jb250YWN0LnVpZCgpfSk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdjb250YWN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdjb250YWN0Q3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0Y29udGFjdDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2NvbnRhY3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignY29udGFjdGRldGFpbHNDdHJsJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UsIEFkZHJlc3NCb29rU2VydmljZSwgdkNhcmRQcm9wZXJ0aWVzU2VydmljZSwgJHJvdXRlLCAkcm91dGVQYXJhbXMsICRzY29wZSkge1xuXG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmxvYWRpbmcgPSB0cnVlO1xuXHRjdHJsLnNob3cgPSBmYWxzZTtcblxuXHRjdHJsLmNsZWFyQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0dWlkOiB1bmRlZmluZWRcblx0XHR9KTtcblx0XHRjdHJsLnNob3cgPSBmYWxzZTtcblx0XHRjdHJsLmNvbnRhY3QgPSB1bmRlZmluZWQ7XG5cdH07XG5cblx0Y3RybC51aWQgPSAkcm91dGVQYXJhbXMudWlkO1xuXHRjdHJsLnQgPSB7XG5cdFx0bm9Db250YWN0cyA6IHQoJ2NvbnRhY3RzJywgJ05vIGNvbnRhY3RzIGluIGhlcmUnKSxcblx0XHRwbGFjZWhvbGRlck5hbWUgOiB0KCdjb250YWN0cycsICdOYW1lJyksXG5cdFx0cGxhY2Vob2xkZXJPcmcgOiB0KCdjb250YWN0cycsICdPcmdhbml6YXRpb24nKSxcblx0XHRwbGFjZWhvbGRlclRpdGxlIDogdCgnY29udGFjdHMnLCAnVGl0bGUnKSxcblx0XHRzZWxlY3RGaWVsZCA6IHQoJ2NvbnRhY3RzJywgJ0FkZCBmaWVsZCAuLi4nKSxcblx0XHRkb3dubG9hZCA6IHQoJ2NvbnRhY3RzJywgJ0Rvd25sb2FkJyksXG5cdFx0ZGVsZXRlIDogdCgnY29udGFjdHMnLCAnRGVsZXRlJylcblx0fTtcblxuXHRjdHJsLmZpZWxkRGVmaW5pdGlvbnMgPSB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLmZpZWxkRGVmaW5pdGlvbnM7XG5cdGN0cmwuZm9jdXMgPSB1bmRlZmluZWQ7XG5cdGN0cmwuZmllbGQgPSB1bmRlZmluZWQ7XG5cdGN0cmwuYWRkcmVzc0Jvb2tzID0gW107XG5cblx0QWRkcmVzc0Jvb2tTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0Y3RybC5hZGRyZXNzQm9va3MgPSBhZGRyZXNzQm9va3M7XG5cblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoY3RybC5jb250YWN0KSkge1xuXHRcdFx0Y3RybC5hZGRyZXNzQm9vayA9IF8uZmluZChjdHJsLmFkZHJlc3NCb29rcywgZnVuY3Rpb24oYm9vaykge1xuXHRcdFx0XHRyZXR1cm4gYm9vay5kaXNwbGF5TmFtZSA9PT0gY3RybC5jb250YWN0LmFkZHJlc3NCb29rSWQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwudWlkJywgZnVuY3Rpb24obmV3VmFsdWUpIHtcblx0XHRjdHJsLmNoYW5nZUNvbnRhY3QobmV3VmFsdWUpO1xuXHR9KTtcblxuXHRjdHJsLmNoYW5nZUNvbnRhY3QgPSBmdW5jdGlvbih1aWQpIHtcblx0XHRpZiAodHlwZW9mIHVpZCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGN0cmwuc2hvdyA9IGZhbHNlO1xuXHRcdFx0JCgnI2FwcC1uYXZpZ2F0aW9uLXRvZ2dsZScpLnJlbW92ZUNsYXNzKCdzaG93ZGV0YWlscycpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRDb250YWN0U2VydmljZS5nZXRCeUlkKHVpZCkudGhlbihmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0XHRpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChjb250YWN0KSkge1xuXHRcdFx0XHRjdHJsLmNsZWFyQ29udGFjdCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmNvbnRhY3QgPSBjb250YWN0O1xuXHRcdFx0Y3RybC5zaG93ID0gdHJ1ZTtcblx0XHRcdCQoJyNhcHAtbmF2aWdhdGlvbi10b2dnbGUnKS5hZGRDbGFzcygnc2hvd2RldGFpbHMnKTtcblxuXHRcdFx0Y3RybC5hZGRyZXNzQm9vayA9IF8uZmluZChjdHJsLmFkZHJlc3NCb29rcywgZnVuY3Rpb24oYm9vaykge1xuXHRcdFx0XHRyZXR1cm4gYm9vay5kaXNwbGF5TmFtZSA9PT0gY3RybC5jb250YWN0LmFkZHJlc3NCb29rSWQ7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVwZGF0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS51cGRhdGUoY3RybC5jb250YWN0KTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS5kZWxldGUoY3RybC5jb250YWN0KTtcblx0fTtcblxuXHRjdHJsLmFkZEZpZWxkID0gZnVuY3Rpb24oZmllbGQpIHtcblx0XHR2YXIgZGVmYXVsdFZhbHVlID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5nZXRNZXRhKGZpZWxkKS5kZWZhdWx0VmFsdWUgfHwge3ZhbHVlOiAnJ307XG5cdFx0Y3RybC5jb250YWN0LmFkZFByb3BlcnR5KGZpZWxkLCBkZWZhdWx0VmFsdWUpO1xuXHRcdGN0cmwuZm9jdXMgPSBmaWVsZDtcblx0XHRjdHJsLmZpZWxkID0gJyc7XG5cdH07XG5cblx0Y3RybC5kZWxldGVGaWVsZCA9IGZ1bmN0aW9uIChmaWVsZCwgcHJvcCkge1xuXHRcdGN0cmwuY29udGFjdC5yZW1vdmVQcm9wZXJ0eShmaWVsZCwgcHJvcCk7XG5cdFx0Y3RybC5mb2N1cyA9IHVuZGVmaW5lZDtcblx0fTtcblxuXHRjdHJsLmNoYW5nZUFkZHJlc3NCb29rID0gZnVuY3Rpb24gKGFkZHJlc3NCb29rKSB7XG5cdFx0Q29udGFjdFNlcnZpY2UubW92ZUNvbnRhY3QoY3RybC5jb250YWN0LCBhZGRyZXNzQm9vayk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdjb250YWN0ZGV0YWlscycsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHByaW9yaXR5OiAxLFxuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnY29udGFjdGRldGFpbHNDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvY29udGFjdERldGFpbHMuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignY29udGFjdGltcG9ydEN0cmwnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5pbXBvcnQgPSBDb250YWN0U2VydmljZS5pbXBvcnQuYmluZChDb250YWN0U2VydmljZSk7XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3RpbXBvcnQnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSkge1xuXHRyZXR1cm4ge1xuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50KSB7XG5cdFx0XHR2YXIgaW1wb3J0VGV4dCA9IHQoJ2NvbnRhY3RzJywgJ0ltcG9ydCcpO1xuXHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IGltcG9ydFRleHQ7XG5cblx0XHRcdHZhciBpbnB1dCA9IGVsZW1lbnQuZmluZCgnaW5wdXQnKTtcblx0XHRcdGlucHV0LmJpbmQoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZmlsZSA9IGlucHV0LmdldCgwKS5maWxlc1swXTtcblx0XHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0XHRcdFx0cmVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0c2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Q29udGFjdFNlcnZpY2UuaW1wb3J0LmNhbGwoQ29udGFjdFNlcnZpY2UsIHJlYWRlci5yZXN1bHQsIGZpbGUudHlwZSwgbnVsbCwgZnVuY3Rpb24ocHJvZ3Jlc3MpIHtcblx0XHRcdFx0XHRcdFx0aWYocHJvZ3Jlc3M9PT0xKSB7XG5cdFx0XHRcdFx0XHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IGltcG9ydFRleHQ7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IHBhcnNlSW50KE1hdGguZmxvb3IocHJvZ3Jlc3MqMTAwKSkrJyUnO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSwgZmFsc2UpO1xuXG5cdFx0XHRcdGlmIChmaWxlKSB7XG5cdFx0XHRcdFx0cmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5wdXQuZ2V0KDApLnZhbHVlID0gJyc7XG5cdFx0XHR9KTtcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0SW1wb3J0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RsaXN0Q3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJGZpbHRlciwgJHJvdXRlLCAkcm91dGVQYXJhbXMsIENvbnRhY3RTZXJ2aWNlLCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLCBTZWFyY2hTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnJvdXRlUGFyYW1zID0gJHJvdXRlUGFyYW1zO1xuXG5cdGN0cmwuY29udGFjdExpc3QgPSBbXTtcblx0Y3RybC5zZWFyY2hUZXJtID0gJyc7XG5cdGN0cmwuc2hvdyA9IHRydWU7XG5cdGN0cmwuaW52YWxpZCA9IGZhbHNlO1xuXG5cdGN0cmwudCA9IHtcblx0XHRlbXB0eVNlYXJjaCA6IHQoJ2NvbnRhY3RzJywgJ05vIHNlYXJjaCByZXN1bHQgZm9yIHtxdWVyeX0nLCB7cXVlcnk6IGN0cmwuc2VhcmNoVGVybX0pXG5cdH07XG5cblx0JHNjb3BlLmdldENvdW50U3RyaW5nID0gZnVuY3Rpb24oY29udGFjdHMpIHtcblx0XHRyZXR1cm4gbignY29udGFjdHMnLCAnJW4gY29udGFjdCcsICclbiBjb250YWN0cycsIGNvbnRhY3RzLmxlbmd0aCk7XG5cdH07XG5cblx0JHNjb3BlLnF1ZXJ5ID0gZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdHJldHVybiBjb250YWN0Lm1hdGNoZXMoU2VhcmNoU2VydmljZS5nZXRTZWFyY2hUZXJtKCkpO1xuXHR9O1xuXG5cdFNlYXJjaFNlcnZpY2UucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrKGZ1bmN0aW9uKGV2KSB7XG5cdFx0aWYgKGV2LmV2ZW50ID09PSAnc3VibWl0U2VhcmNoJykge1xuXHRcdFx0dmFyIHVpZCA9ICFfLmlzRW1wdHkoY3RybC5jb250YWN0TGlzdCkgPyBjdHJsLmNvbnRhY3RMaXN0WzBdLnVpZCgpIDogdW5kZWZpbmVkO1xuXHRcdFx0Y3RybC5zZXRTZWxlY3RlZElkKHVpZCk7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fVxuXHRcdGlmIChldi5ldmVudCA9PT0gJ2NoYW5nZVNlYXJjaCcpIHtcblx0XHRcdGN0cmwuc2VhcmNoVGVybSA9IGV2LnNlYXJjaFRlcm07XG5cdFx0XHRjdHJsLnQuZW1wdHlTZWFyY2ggPSB0KCdjb250YWN0cycsXG5cdFx0XHRcdFx0XHRcdFx0ICAgJ05vIHNlYXJjaCByZXN1bHQgZm9yIHtxdWVyeX0nLFxuXHRcdFx0XHRcdFx0XHRcdCAgIHtxdWVyeTogY3RybC5zZWFyY2hUZXJtfVxuXHRcdFx0XHRcdFx0XHRcdCAgKTtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9XG5cdH0pO1xuXG5cdGN0cmwubG9hZGluZyA9IHRydWU7XG5cblx0Q29udGFjdFNlcnZpY2UucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrKGZ1bmN0aW9uKGV2KSB7XG5cdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdGlmIChldi5ldmVudCA9PT0gJ2RlbGV0ZScpIHtcblx0XHRcdFx0aWYgKGN0cmwuY29udGFjdExpc3QubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0XHR1aWQ6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoY3RybC5jb250YWN0TGlzdFtpXS51aWQoKSA9PT0gZXYudWlkKSB7XG5cdFx0XHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdFx0XHR1aWQ6IChjdHJsLmNvbnRhY3RMaXN0W2krMV0pID8gY3RybC5jb250YWN0TGlzdFtpKzFdLnVpZCgpIDogY3RybC5jb250YWN0TGlzdFtpLTFdLnVpZCgpXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGV2LmV2ZW50ID09PSAnY3JlYXRlJykge1xuXHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0dWlkOiBldi51aWRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmNvbnRhY3RzID0gZXYuY29udGFjdHM7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIEdldCBjb250YWN0c1xuXHRDb250YWN0U2VydmljZS5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3RzKSB7XG5cdFx0aWYoY29udGFjdHMubGVuZ3RoPjApIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGN0cmwuY29udGFjdHMgPSBjb250YWN0cztcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFdhaXQgZm9yIGN0cmwuY29udGFjdExpc3QgdG8gYmUgdXBkYXRlZCwgbG9hZCB0aGUgZmlyc3QgY29udGFjdCBhbmQga2lsbCB0aGUgd2F0Y2hcblx0dmFyIHVuYmluZExpc3RXYXRjaCA9ICRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3QnLCBmdW5jdGlvbigpIHtcblx0XHRpZihjdHJsLmNvbnRhY3RMaXN0ICYmIGN0cmwuY29udGFjdExpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgYSBzcGVjaWZpYyB1aWQgaXMgcmVxdWVzdGVkXG5cdFx0XHRpZigkcm91dGVQYXJhbXMudWlkICYmICRyb3V0ZVBhcmFtcy5naWQpIHtcblx0XHRcdFx0Y3RybC5jb250YWN0TGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdFx0XHRpZihjb250YWN0LnVpZCgpID09PSAkcm91dGVQYXJhbXMudWlkKSB7XG5cdFx0XHRcdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQoJHJvdXRlUGFyYW1zLnVpZCk7XG5cdFx0XHRcdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0Ly8gTm8gY29udGFjdCBwcmV2aW91c2x5IGxvYWRlZCwgbGV0J3MgbG9hZCB0aGUgZmlyc3Qgb2YgdGhlIGxpc3QgaWYgbm90IGluIG1vYmlsZSBtb2RlXG5cdFx0XHRpZihjdHJsLmxvYWRpbmcgJiYgJCh3aW5kb3cpLndpZHRoKCkgPiA3NjgpIHtcblx0XHRcdFx0Y3RybC5zZXRTZWxlY3RlZElkKGN0cmwuY29udGFjdExpc3RbMF0udWlkKCkpO1xuXHRcdFx0fVxuXHRcdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHR1bmJpbmRMaXN0V2F0Y2goKTtcblx0XHR9XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwucm91dGVQYXJhbXMudWlkJywgZnVuY3Rpb24obmV3VmFsdWUsIG9sZFZhbHVlKSB7XG5cdFx0Ly8gVXNlZCBmb3IgbW9iaWxlIHZpZXcgdG8gY2xlYXIgdGhlIHVybFxuXHRcdGlmKHR5cGVvZiBvbGRWYWx1ZSAhPSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbmV3VmFsdWUgPT0gJ3VuZGVmaW5lZCcgJiYgJCh3aW5kb3cpLndpZHRoKCkgPD0gNzY4KSB7XG5cdFx0XHQvLyBubyBjb250YWN0IHNlbGVjdGVkXG5cdFx0XHRjdHJsLnNob3cgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZihuZXdWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyB3ZSBtaWdodCBoYXZlIHRvIHdhaXQgdW50aWwgbmctcmVwZWF0IGZpbGxlZCB0aGUgY29udGFjdExpc3Rcblx0XHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHR1aWQ6IGN0cmwuY29udGFjdExpc3RbMF0udWlkKClcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyB3YXRjaCBmb3IgbmV4dCBjb250YWN0TGlzdCB1cGRhdGVcblx0XHRcdFx0dmFyIHVuYmluZFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0XHR1aWQ6IGN0cmwuY29udGFjdExpc3RbMF0udWlkKClcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR1bmJpbmRXYXRjaCgpOyAvLyB1bmJpbmQgYXMgd2Ugb25seSB3YW50IG9uZSB1cGRhdGVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGRpc3BsYXlpbmcgY29udGFjdCBkZXRhaWxzXG5cdFx0XHRjdHJsLnNob3cgPSBmYWxzZTtcblx0XHR9XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwucm91dGVQYXJhbXMuZ2lkJywgZnVuY3Rpb24oKSB7XG5cdFx0Ly8gd2UgbWlnaHQgaGF2ZSB0byB3YWl0IHVudGlsIG5nLXJlcGVhdCBmaWxsZWQgdGhlIGNvbnRhY3RMaXN0XG5cdFx0Y3RybC5jb250YWN0TGlzdCA9IFtdO1xuXHRcdC8vIG5vdCBpbiBtb2JpbGUgbW9kZVxuXHRcdGlmKCQod2luZG93KS53aWR0aCgpID4gNzY4KSB7XG5cdFx0XHQvLyB3YXRjaCBmb3IgbmV4dCBjb250YWN0TGlzdCB1cGRhdGVcblx0XHRcdHZhciB1bmJpbmRXYXRjaCA9ICRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3QnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHVuYmluZFdhdGNoKCk7IC8vIHVuYmluZCBhcyB3ZSBvbmx5IHdhbnQgb25lIHVwZGF0ZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBXYXRjaCBpZiB3ZSBoYXZlIGFuIGludmFsaWQgY29udGFjdFxuXHQkc2NvcGUuJHdhdGNoKCdjdHJsLmNvbnRhY3RMaXN0WzBdLmRpc3BsYXlOYW1lKCknLCBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdGN0cmwuaW52YWxpZCA9IChkaXNwbGF5TmFtZSA9PT0gJycpO1xuXHR9KTtcblxuXHRjdHJsLmhhc0NvbnRhY3RzID0gZnVuY3Rpb24gKCkge1xuXHRcdGlmICghY3RybC5jb250YWN0cykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gY3RybC5jb250YWN0cy5sZW5ndGggPiAwO1xuXHR9O1xuXG5cdGN0cmwuc2V0U2VsZWN0ZWRJZCA9IGZ1bmN0aW9uIChjb250YWN0SWQpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdHVpZDogY29udGFjdElkXG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC5nZXRTZWxlY3RlZElkID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuICRyb3V0ZVBhcmFtcy51aWQ7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3RsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cHJpb3JpdHk6IDEsXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdjb250YWN0bGlzdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHtcblx0XHRcdGFkZHJlc3Nib29rOiAnPWFkcmJvb2snXG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvY29udGFjdExpc3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignZGV0YWlsc0l0ZW1DdHJsJywgZnVuY3Rpb24oJHRlbXBsYXRlUmVxdWVzdCwgdkNhcmRQcm9wZXJ0aWVzU2VydmljZSwgQ29udGFjdFNlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwubWV0YSA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZ2V0TWV0YShjdHJsLm5hbWUpO1xuXHRjdHJsLnR5cGUgPSB1bmRlZmluZWQ7XG5cdGN0cmwuaXNQcmVmZXJyZWQgPSBmYWxzZTtcblx0Y3RybC50ID0ge1xuXHRcdHBvQm94IDogdCgnY29udGFjdHMnLCAnUG9zdCBvZmZpY2UgYm94JyksXG5cdFx0cG9zdGFsQ29kZSA6IHQoJ2NvbnRhY3RzJywgJ1Bvc3RhbCBjb2RlJyksXG5cdFx0Y2l0eSA6IHQoJ2NvbnRhY3RzJywgJ0NpdHknKSxcblx0XHRzdGF0ZSA6IHQoJ2NvbnRhY3RzJywgJ1N0YXRlIG9yIHByb3ZpbmNlJyksXG5cdFx0Y291bnRyeSA6IHQoJ2NvbnRhY3RzJywgJ0NvdW50cnknKSxcblx0XHRhZGRyZXNzOiB0KCdjb250YWN0cycsICdBZGRyZXNzJyksXG5cdFx0bmV3R3JvdXA6IHQoJ2NvbnRhY3RzJywgJyhuZXcgZ3JvdXApJyksXG5cdFx0ZmFtaWx5TmFtZTogdCgnY29udGFjdHMnLCAnTGFzdCBuYW1lJyksXG5cdFx0Zmlyc3ROYW1lOiB0KCdjb250YWN0cycsICdGaXJzdCBuYW1lJyksXG5cdFx0YWRkaXRpb25hbE5hbWVzOiB0KCdjb250YWN0cycsICdBZGRpdGlvbmFsIG5hbWVzJyksXG5cdFx0aG9ub3JpZmljUHJlZml4OiB0KCdjb250YWN0cycsICdQcmVmaXgnKSxcblx0XHRob25vcmlmaWNTdWZmaXg6IHQoJ2NvbnRhY3RzJywgJ1N1ZmZpeCcpLFxuXHRcdGRlbGV0ZTogdCgnY29udGFjdHMnLCAnRGVsZXRlJylcblx0fTtcblxuXHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLm1ldGEub3B0aW9ucyB8fCBbXTtcblx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YSkgJiYgIV8uaXNVbmRlZmluZWQoY3RybC5kYXRhLm1ldGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5tZXRhLnR5cGUpKSB7XG5cdFx0Ly8gcGFyc2UgdHlwZSBvZiB0aGUgcHJvcGVydHlcblx0XHR2YXIgYXJyYXkgPSBjdHJsLmRhdGEubWV0YS50eXBlWzBdLnNwbGl0KCcsJyk7XG5cdFx0YXJyYXkgPSBhcnJheS5tYXAoZnVuY3Rpb24gKGVsZW0pIHtcblx0XHRcdHJldHVybiBlbGVtLnRyaW0oKS5yZXBsYWNlKC9cXC8rJC8sICcnKS5yZXBsYWNlKC9cXFxcKyQvLCAnJykudHJpbSgpLnRvVXBwZXJDYXNlKCk7XG5cdFx0fSk7XG5cdFx0Ly8gdGhlIHByZWYgdmFsdWUgaXMgaGFuZGxlZCBvbiBpdHMgb3duIHNvIHRoYXQgd2UgY2FuIGFkZCBzb21lIGZhdm9yaXRlIGljb24gdG8gdGhlIHVpIGlmIHdlIHdhbnRcblx0XHRpZiAoYXJyYXkuaW5kZXhPZignUFJFRicpID49IDApIHtcblx0XHRcdGN0cmwuaXNQcmVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0YXJyYXkuc3BsaWNlKGFycmF5LmluZGV4T2YoJ1BSRUYnKSwgMSk7XG5cdFx0fVxuXHRcdC8vIHNpbXBseSBqb2luIHRoZSB1cHBlciBjYXNlZCB0eXBlcyB0b2dldGhlciBhcyBrZXlcblx0XHRjdHJsLnR5cGUgPSBhcnJheS5qb2luKCcsJyk7XG5cdFx0dmFyIGRpc3BsYXlOYW1lID0gYXJyYXkubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGVsZW1lbnQuc2xpY2UoMSkudG9Mb3dlckNhc2UoKTtcblx0XHR9KS5qb2luKCcgJyk7XG5cblx0XHQvLyBpbiBjYXNlIHRoZSB0eXBlIGlzIG5vdCB5ZXQgaW4gdGhlIGRlZmF1bHQgbGlzdCBvZiBhdmFpbGFibGUgb3B0aW9ucyB3ZSBhZGQgaXRcblx0XHRpZiAoIWN0cmwuYXZhaWxhYmxlT3B0aW9ucy5zb21lKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGUuaWQgPT09IGN0cmwudHlwZTsgfSApKSB7XG5cdFx0XHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLmF2YWlsYWJsZU9wdGlvbnMuY29uY2F0KFt7aWQ6IGN0cmwudHlwZSwgbmFtZTogZGlzcGxheU5hbWV9XSk7XG5cdFx0fVxuXHR9XG5cdGlmICghXy5pc1VuZGVmaW5lZChjdHJsLmRhdGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5uYW1lc3BhY2UpKSB7XG5cdFx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwubW9kZWwuY29udGFjdC5wcm9wc1snWC1BQkxBQkVMJ10pKSB7XG5cdFx0XHR2YXIgdmFsID0gXy5maW5kKHRoaXMubW9kZWwuY29udGFjdC5wcm9wc1snWC1BQkxBQkVMJ10sIGZ1bmN0aW9uKHgpIHsgcmV0dXJuIHgubmFtZXNwYWNlID09PSBjdHJsLmRhdGEubmFtZXNwYWNlOyB9KTtcblx0XHRcdGN0cmwudHlwZSA9IHZhbC52YWx1ZTtcblx0XHRcdGlmICghXy5pc1VuZGVmaW5lZCh2YWwpKSB7XG5cdFx0XHRcdC8vIGluIGNhc2UgdGhlIHR5cGUgaXMgbm90IHlldCBpbiB0aGUgZGVmYXVsdCBsaXN0IG9mIGF2YWlsYWJsZSBvcHRpb25zIHdlIGFkZCBpdFxuXHRcdFx0XHRpZiAoIWN0cmwuYXZhaWxhYmxlT3B0aW9ucy5zb21lKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGUuaWQgPT09IHZhbC52YWx1ZTsgfSApKSB7XG5cdFx0XHRcdFx0Y3RybC5hdmFpbGFibGVPcHRpb25zID0gY3RybC5hdmFpbGFibGVPcHRpb25zLmNvbmNhdChbe2lkOiB2YWwudmFsdWUsIG5hbWU6IHZhbC52YWx1ZX1dKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRjdHJsLmF2YWlsYWJsZUdyb3VwcyA9IFtdO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5hdmFpbGFibGVHcm91cHMgPSBfLnVuaXF1ZShncm91cHMpO1xuXHR9KTtcblxuXHRjdHJsLmNoYW5nZVR5cGUgPSBmdW5jdGlvbiAodmFsKSB7XG5cdFx0aWYgKGN0cmwuaXNQcmVmZXJyZWQpIHtcblx0XHRcdHZhbCArPSAnLFBSRUYnO1xuXHRcdH1cblx0XHRjdHJsLmRhdGEubWV0YSA9IGN0cmwuZGF0YS5tZXRhIHx8IHt9O1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGUgPSBjdHJsLmRhdGEubWV0YS50eXBlIHx8IFtdO1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGVbMF0gPSB2YWw7XG5cdFx0Y3RybC5tb2RlbC51cGRhdGVDb250YWN0KCk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVEZXRhaWxlZE5hbWUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGZuID0gJyc7XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVszXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzNdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzFdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbMV0gKyAnICc7XG5cdFx0fVxuXHRcdGlmIChjdHJsLmRhdGEudmFsdWVbMl0pIHtcblx0XHRcdGZuICs9IGN0cmwuZGF0YS52YWx1ZVsyXSArICcgJztcblx0XHR9XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVswXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzBdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzRdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbNF07XG5cdFx0fVxuXG5cdFx0Y3RybC5tb2RlbC5jb250YWN0LmZ1bGxOYW1lKGZuKTtcblx0XHRjdHJsLm1vZGVsLnVwZGF0ZUNvbnRhY3QoKTtcblx0fTtcblxuXHRjdHJsLmdldFRlbXBsYXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHRlbXBsYXRlVXJsID0gT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZGV0YWlsSXRlbXMvJyArIGN0cmwubWV0YS50ZW1wbGF0ZSArICcuaHRtbCcpO1xuXHRcdHJldHVybiAkdGVtcGxhdGVSZXF1ZXN0KHRlbXBsYXRlVXJsKTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUZpZWxkID0gZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwubW9kZWwuZGVsZXRlRmllbGQoY3RybC5uYW1lLCBjdHJsLmRhdGEpO1xuXHRcdGN0cmwubW9kZWwudXBkYXRlQ29udGFjdCgpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZGV0YWlsc2l0ZW0nLCBbJyRjb21waWxlJywgZnVuY3Rpb24oJGNvbXBpbGUpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2RldGFpbHNJdGVtQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0bmFtZTogJz0nLFxuXHRcdFx0ZGF0YTogJz0nLFxuXHRcdFx0bW9kZWw6ICc9J1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XG5cdFx0XHRjdHJsLmdldFRlbXBsYXRlKCkudGhlbihmdW5jdGlvbihodG1sKSB7XG5cdFx0XHRcdHZhciB0ZW1wbGF0ZSA9IGFuZ3VsYXIuZWxlbWVudChodG1sKTtcblx0XHRcdFx0ZWxlbWVudC5hcHBlbmQodGVtcGxhdGUpO1xuXHRcdFx0XHQkY29tcGlsZSh0ZW1wbGF0ZSkoc2NvcGUpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufV0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cEN0cmwnLCBmdW5jdGlvbigpIHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5cdHZhciBjdHJsID0gdGhpcztcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2dyb3VwJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2dyb3VwQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0Z3JvdXA6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9ncm91cC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cGxpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgU2VhcmNoU2VydmljZSwgJHJvdXRlUGFyYW1zKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHR2YXIgaW5pdGlhbEdyb3VwcyA9IFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV07XG5cblx0Y3RybC5ncm91cHMgPSBpbml0aWFsR3JvdXBzO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5ncm91cHMgPSBfLnVuaXF1ZShpbml0aWFsR3JvdXBzLmNvbmNhdChncm91cHMpKTtcblx0fSk7XG5cblx0Y3RybC5nZXRTZWxlY3RlZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiAkcm91dGVQYXJhbXMuZ2lkO1xuXHR9O1xuXG5cdC8vIFVwZGF0ZSBncm91cExpc3Qgb24gY29udGFjdCBhZGQvZGVsZXRlL3VwZGF0ZVxuXHRDb250YWN0U2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oKSB7XG5cdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0XHRcdGN0cmwuZ3JvdXBzID0gXy51bmlxdWUoaW5pdGlhbEdyb3Vwcy5jb25jYXQoZ3JvdXBzKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0Y3RybC5zZXRTZWxlY3RlZCA9IGZ1bmN0aW9uIChzZWxlY3RlZEdyb3VwKSB7XG5cdFx0U2VhcmNoU2VydmljZS5jbGVhblNlYXJjaCgpO1xuXHRcdCRyb3V0ZVBhcmFtcy5naWQgPSBzZWxlY3RlZEdyb3VwO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZ3JvdXBsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFQScsIC8vIGhhcyB0byBiZSBhbiBhdHRyaWJ1dGUgdG8gd29yayB3aXRoIGNvcmUgY3NzXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdncm91cGxpc3RDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZ3JvdXBMaXN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ25ld0NvbnRhY3RCdXR0b25DdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgJHJvdXRlUGFyYW1zLCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnQgPSB7XG5cdFx0YWRkQ29udGFjdCA6IHQoJ2NvbnRhY3RzJywgJ05ldyBjb250YWN0Jylcblx0fTtcblxuXHRjdHJsLmNyZWF0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS5jcmVhdGUoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdFsndGVsJywgJ2FkcicsICdlbWFpbCddLmZvckVhY2goZnVuY3Rpb24oZmllbGQpIHtcblx0XHRcdFx0dmFyIGRlZmF1bHRWYWx1ZSA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZ2V0TWV0YShmaWVsZCkuZGVmYXVsdFZhbHVlIHx8IHt2YWx1ZTogJyd9O1xuXHRcdFx0XHRjb250YWN0LmFkZFByb3BlcnR5KGZpZWxkLCBkZWZhdWx0VmFsdWUpO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV0uaW5kZXhPZigkcm91dGVQYXJhbXMuZ2lkKSA9PT0gLTEpIHtcblx0XHRcdFx0Y29udGFjdC5jYXRlZ29yaWVzKCRyb3V0ZVBhcmFtcy5naWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udGFjdC5jYXRlZ29yaWVzKCcnKTtcblx0XHRcdH1cblx0XHRcdCQoJyNkZXRhaWxzLWZ1bGxOYW1lJykuZm9jdXMoKTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ25ld2NvbnRhY3RidXR0b24nLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0VBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ25ld0NvbnRhY3RCdXR0b25DdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvbmV3Q29udGFjdEJ1dHRvbi5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ3RlbE1vZGVsJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybntcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdHJlcXVpcmU6ICduZ01vZGVsJyxcblx0XHRsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0ciwgbmdNb2RlbCkge1xuXHRcdFx0bmdNb2RlbC4kZm9ybWF0dGVycy5wdXNoKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH0pO1xuXHRcdFx0bmdNb2RlbC4kcGFyc2Vycy5wdXNoKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5mYWN0b3J5KCdBZGRyZXNzQm9vaycsIGZ1bmN0aW9uKClcbntcblx0cmV0dXJuIGZ1bmN0aW9uIEFkZHJlc3NCb29rKGRhdGEpIHtcblx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLCB7XG5cblx0XHRcdGRpc3BsYXlOYW1lOiAnJyxcblx0XHRcdGNvbnRhY3RzOiBbXSxcblx0XHRcdGdyb3VwczogZGF0YS5kYXRhLnByb3BzLmdyb3VwcyxcblxuXHRcdFx0Z2V0Q29udGFjdDogZnVuY3Rpb24odWlkKSB7XG5cdFx0XHRcdGZvcih2YXIgaSBpbiB0aGlzLmNvbnRhY3RzKSB7XG5cdFx0XHRcdFx0aWYodGhpcy5jb250YWN0c1tpXS51aWQoKSA9PT0gdWlkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5jb250YWN0c1tpXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cblx0XHRcdHNoYXJlZFdpdGg6IHtcblx0XHRcdFx0dXNlcnM6IFtdLFxuXHRcdFx0XHRncm91cHM6IFtdXG5cdFx0XHR9XG5cblx0XHR9KTtcblx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLCBkYXRhKTtcblx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLCB7XG5cdFx0XHRvd25lcjogZGF0YS51cmwuc3BsaXQoJy8nKS5zbGljZSgtMywgLTIpWzBdXG5cdFx0fSk7XG5cblx0XHR2YXIgc2hhcmVzID0gdGhpcy5kYXRhLnByb3BzLmludml0ZTtcblx0XHRpZiAodHlwZW9mIHNoYXJlcyAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgc2hhcmVzLmxlbmd0aDsgaisrKSB7XG5cdFx0XHRcdHZhciBocmVmID0gc2hhcmVzW2pdLmhyZWY7XG5cdFx0XHRcdGlmIChocmVmLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBhY2Nlc3MgPSBzaGFyZXNbal0uYWNjZXNzO1xuXHRcdFx0XHRpZiAoYWNjZXNzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIHJlYWRXcml0ZSA9ICh0eXBlb2YgYWNjZXNzLnJlYWRXcml0ZSAhPT0gJ3VuZGVmaW5lZCcpO1xuXG5cdFx0XHRcdGlmIChocmVmLnN0YXJ0c1dpdGgoJ3ByaW5jaXBhbDpwcmluY2lwYWxzL3VzZXJzLycpKSB7XG5cdFx0XHRcdFx0dGhpcy5zaGFyZWRXaXRoLnVzZXJzLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6IGhyZWYuc3Vic3RyKDI3KSxcblx0XHRcdFx0XHRcdGRpc3BsYXluYW1lOiBocmVmLnN1YnN0cigyNyksXG5cdFx0XHRcdFx0XHR3cml0YWJsZTogcmVhZFdyaXRlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaHJlZi5zdGFydHNXaXRoKCdwcmluY2lwYWw6cHJpbmNpcGFscy9ncm91cHMvJykpIHtcblx0XHRcdFx0XHR0aGlzLnNoYXJlZFdpdGguZ3JvdXBzLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6IGhyZWYuc3Vic3RyKDI4KSxcblx0XHRcdFx0XHRcdGRpc3BsYXluYW1lOiBocmVmLnN1YnN0cigyOCksXG5cdFx0XHRcdFx0XHR3cml0YWJsZTogcmVhZFdyaXRlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL3ZhciBvd25lciA9IHRoaXMuZGF0YS5wcm9wcy5vd25lcjtcblx0XHQvL2lmICh0eXBlb2Ygb3duZXIgIT09ICd1bmRlZmluZWQnICYmIG93bmVyLmxlbmd0aCAhPT0gMCkge1xuXHRcdC8vXHRvd25lciA9IG93bmVyLnRyaW0oKTtcblx0XHQvL1x0aWYgKG93bmVyLnN0YXJ0c1dpdGgoJy9yZW1vdGUucGhwL2Rhdi9wcmluY2lwYWxzL3VzZXJzLycpKSB7XG5cdFx0Ly9cdFx0dGhpcy5fcHJvcGVydGllcy5vd25lciA9IG93bmVyLnN1YnN0cigzMyk7XG5cdFx0Ly9cdH1cblx0XHQvL31cblxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZhY3RvcnkoJ0NvbnRhY3QnLCBmdW5jdGlvbigkZmlsdGVyKSB7XG5cdHJldHVybiBmdW5jdGlvbiBDb250YWN0KGFkZHJlc3NCb29rLCB2Q2FyZCkge1xuXHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMsIHtcblxuXHRcdFx0ZGF0YToge30sXG5cdFx0XHRwcm9wczoge30sXG5cblx0XHRcdGRhdGVQcm9wZXJ0aWVzOiBbJ2JkYXknLCAnYW5uaXZlcnNhcnknLCAnZGVhdGhkYXRlJ10sXG5cblx0XHRcdGFkZHJlc3NCb29rSWQ6IGFkZHJlc3NCb29rLmRpc3BsYXlOYW1lLFxuXG5cdFx0XHR2ZXJzaW9uOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgndmVyc2lvbicpO1xuXHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXG5cdFx0XHR1aWQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHZhciBtb2RlbCA9IHRoaXM7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuc2V0UHJvcGVydHkoJ3VpZCcsIHsgdmFsdWU6IHZhbHVlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHRcdHJldHVybiBtb2RlbC5nZXRQcm9wZXJ0eSgndWlkJykudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGRpc3BsYXlOYW1lOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnVsbE5hbWUoKSB8fCB0aGlzLm9yZygpIHx8ICcnO1xuXHRcdFx0fSxcblxuXHRcdFx0ZnVsbE5hbWU6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHZhciBtb2RlbCA9IHRoaXM7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRQcm9wZXJ0eSgnZm4nLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHR2YXIgcHJvcGVydHkgPSBtb2RlbC5nZXRQcm9wZXJ0eSgnZm4nKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwcm9wZXJ0eSA9IG1vZGVsLmdldFByb3BlcnR5KCduJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZS5maWx0ZXIoZnVuY3Rpb24oZWxlbSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZWxlbTtcblx0XHRcdFx0XHRcdH0pLmpvaW4oJyAnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0dGl0bGU6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRQcm9wZXJ0eSgndGl0bGUnLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCd0aXRsZScpO1xuXHRcdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRvcmc6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ29yZycpO1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0dmFyIHZhbCA9IHZhbHVlO1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdGlmKHByb3BlcnR5ICYmIEFycmF5LmlzQXJyYXkocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHR2YWwgPSBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHRcdHZhbFswXSA9IHZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRQcm9wZXJ0eSgnb3JnJywgeyB2YWx1ZTogdmFsIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheShwcm9wZXJ0eS52YWx1ZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlWzBdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0ZW1haWw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgnZW1haWwnKTtcblx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0cGhvdG86IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHQvLyBzcGxpdHMgaW1hZ2UgZGF0YSBpbnRvIFwiZGF0YTppbWFnZS9qcGVnXCIgYW5kIGJhc2UgNjQgZW5jb2RlZCBpbWFnZVxuXHRcdFx0XHRcdHZhciBpbWFnZURhdGEgPSB2YWx1ZS5zcGxpdCgnO2Jhc2U2NCwnKTtcblx0XHRcdFx0XHR2YXIgaW1hZ2VUeXBlID0gaW1hZ2VEYXRhWzBdLnNsaWNlKCdkYXRhOicubGVuZ3RoKTtcblx0XHRcdFx0XHRpZiAoIWltYWdlVHlwZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpbWFnZVR5cGUgPSBpbWFnZVR5cGUuc3Vic3RyaW5nKDYpLnRvVXBwZXJDYXNlKCk7XG5cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRQcm9wZXJ0eSgncGhvdG8nLCB7IHZhbHVlOiBpbWFnZURhdGFbMV0sIG1ldGE6IHt0eXBlOiBbaW1hZ2VUeXBlXSwgZW5jb2Rpbmc6IFsnYiddfSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdwaG90bycpO1xuXHRcdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHR2YXIgdHlwZSA9IHByb3BlcnR5Lm1ldGEudHlwZTtcblx0XHRcdFx0XHRcdGlmIChhbmd1bGFyLmlzQXJyYXkodHlwZSkpIHtcblx0XHRcdFx0XHRcdFx0dHlwZSA9IHR5cGVbMF07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIXR5cGUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpIHtcblx0XHRcdFx0XHRcdFx0dHlwZSA9ICdpbWFnZS8nICsgdHlwZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuICdkYXRhOicgKyB0eXBlICsgJztiYXNlNjQsJyArIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0Y2F0ZWdvcmllczogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFByb3BlcnR5KCdjYXRlZ29yaWVzJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgnY2F0ZWdvcmllcycpO1xuXHRcdFx0XHRcdGlmKCFwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoYW5ndWxhci5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gW3Byb3BlcnR5LnZhbHVlXTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0Zm9ybWF0RGF0ZUFzUkZDNjM1MDogZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuXHRcdFx0XHRpZiAoXy5pc1VuZGVmaW5lZChkYXRhKSB8fCBfLmlzVW5kZWZpbmVkKGRhdGEudmFsdWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuZGF0ZVByb3BlcnRpZXMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBkYXRhLnZhbHVlLm1hdGNoKC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkkLyk7XG5cdFx0XHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdFx0XHRkYXRhLnZhbHVlID0gbWF0Y2hbMV0gKyBtYXRjaFsyXSArIG1hdGNoWzNdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBkYXRhO1xuXHRcdFx0fSxcblxuXHRcdFx0Zm9ybWF0RGF0ZUZvckRpc3BsYXk6IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcblx0XHRcdFx0aWYgKF8uaXNVbmRlZmluZWQoZGF0YSkgfHwgXy5pc1VuZGVmaW5lZChkYXRhLnZhbHVlKSkge1xuXHRcdFx0XHRcdHJldHVybiBkYXRhO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0aGlzLmRhdGVQcm9wZXJ0aWVzLmluZGV4T2YobmFtZSkgIT09IC0xKSB7XG5cdFx0XHRcdFx0dmFyIG1hdGNoID0gZGF0YS52YWx1ZS5tYXRjaCgvXihcXGR7NH0pKFxcZHsyfSkoXFxkezJ9KSQvKTtcblx0XHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRcdGRhdGEudmFsdWUgPSBtYXRjaFsxXSArICctJyArIG1hdGNoWzJdICsgJy0nICsgbWF0Y2hbM107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHR9LFxuXG5cdFx0XHRnZXRQcm9wZXJ0eTogZnVuY3Rpb24obmFtZSkge1xuXHRcdFx0XHRpZiAodGhpcy5wcm9wc1tuYW1lXSkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmZvcm1hdERhdGVGb3JEaXNwbGF5KG5hbWUsIHRoaXMucHJvcHNbbmFtZV1bMF0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZGRQcm9wZXJ0eTogZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuXHRcdFx0XHRkYXRhID0gYW5ndWxhci5jb3B5KGRhdGEpO1xuXHRcdFx0XHRkYXRhID0gdGhpcy5mb3JtYXREYXRlQXNSRkM2MzUwKG5hbWUsIGRhdGEpO1xuXHRcdFx0XHRpZighdGhpcy5wcm9wc1tuYW1lXSkge1xuXHRcdFx0XHRcdHRoaXMucHJvcHNbbmFtZV0gPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgaWR4ID0gdGhpcy5wcm9wc1tuYW1lXS5sZW5ndGg7XG5cdFx0XHRcdHRoaXMucHJvcHNbbmFtZV1baWR4XSA9IGRhdGE7XG5cblx0XHRcdFx0Ly8ga2VlcCB2Q2FyZCBpbiBzeW5jXG5cdFx0XHRcdHRoaXMuZGF0YS5hZGRyZXNzRGF0YSA9ICRmaWx0ZXIoJ0pTT04ydkNhcmQnKSh0aGlzLnByb3BzKTtcblx0XHRcdFx0cmV0dXJuIGlkeDtcblx0XHRcdH0sXG5cdFx0XHRzZXRQcm9wZXJ0eTogZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuXHRcdFx0XHRpZighdGhpcy5wcm9wc1tuYW1lXSkge1xuXHRcdFx0XHRcdHRoaXMucHJvcHNbbmFtZV0gPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkYXRhID0gdGhpcy5mb3JtYXREYXRlQXNSRkM2MzUwKG5hbWUsIGRhdGEpO1xuXHRcdFx0XHR0aGlzLnByb3BzW25hbWVdWzBdID0gZGF0YTtcblxuXHRcdFx0XHQvLyBrZWVwIHZDYXJkIGluIHN5bmNcblx0XHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdFx0fSxcblx0XHRcdHJlbW92ZVByb3BlcnR5OiBmdW5jdGlvbiAobmFtZSwgcHJvcCkge1xuXHRcdFx0XHRhbmd1bGFyLmNvcHkoXy53aXRob3V0KHRoaXMucHJvcHNbbmFtZV0sIHByb3ApLCB0aGlzLnByb3BzW25hbWVdKTtcblx0XHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdFx0fSxcblx0XHRcdHNldEVUYWc6IGZ1bmN0aW9uKGV0YWcpIHtcblx0XHRcdFx0dGhpcy5kYXRhLmV0YWcgPSBldGFnO1xuXHRcdFx0fSxcblx0XHRcdHNldFVybDogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIHVpZCkge1xuXHRcdFx0XHR0aGlzLmRhdGEudXJsID0gYWRkcmVzc0Jvb2sudXJsICsgdWlkICsgJy52Y2YnO1xuXHRcdFx0fSxcblxuXHRcdFx0Z2V0SVNPRGF0ZTogZnVuY3Rpb24oZGF0ZSkge1xuXHRcdFx0XHRmdW5jdGlvbiBwYWQobnVtYmVyKSB7XG5cdFx0XHRcdFx0aWYgKG51bWJlciA8IDEwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJzAnICsgbnVtYmVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gJycgKyBudW1iZXI7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZGF0ZS5nZXRVVENGdWxsWWVhcigpICsgJycgK1xuXHRcdFx0XHRcdFx0cGFkKGRhdGUuZ2V0VVRDTW9udGgoKSArIDEpICtcblx0XHRcdFx0XHRcdHBhZChkYXRlLmdldFVUQ0RhdGUoKSkgK1xuXHRcdFx0XHRcdFx0J1QnICsgcGFkKGRhdGUuZ2V0VVRDSG91cnMoKSkgK1xuXHRcdFx0XHRcdFx0cGFkKGRhdGUuZ2V0VVRDTWludXRlcygpKSArXG5cdFx0XHRcdFx0XHRwYWQoZGF0ZS5nZXRVVENTZWNvbmRzKCkpO1xuXHRcdFx0fSxcblxuXHRcdFx0c3luY1ZDYXJkOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0XHR0aGlzLnNldFByb3BlcnR5KCdyZXYnLCB7IHZhbHVlOiB0aGlzLmdldElTT0RhdGUobmV3IERhdGUoKSkgfSk7XG5cdFx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0XHRfLmVhY2godGhpcy5kYXRlUHJvcGVydGllcywgZnVuY3Rpb24obmFtZSkge1xuXHRcdFx0XHRcdGlmICghXy5pc1VuZGVmaW5lZChzZWxmLnByb3BzW25hbWVdKSAmJiAhXy5pc1VuZGVmaW5lZChzZWxmLnByb3BzW25hbWVdWzBdKSkge1xuXHRcdFx0XHRcdFx0Ly8gU2V0IGRhdGVzIGFnYWluIHRvIG1ha2Ugc3VyZSB0aGV5IGFyZSBpbiBSRkMtNjM1MCBmb3JtYXRcblx0XHRcdFx0XHRcdHNlbGYuc2V0UHJvcGVydHkobmFtZSwgc2VsZi5wcm9wc1tuYW1lXVswXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Ly8gZm9yY2UgZm4gdG8gYmUgc2V0XG5cdFx0XHRcdHRoaXMuZnVsbE5hbWUodGhpcy5mdWxsTmFtZSgpKTtcblxuXHRcdFx0XHQvLyBrZWVwIHZDYXJkIGluIHN5bmNcblx0XHRcdFx0c2VsZi5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHNlbGYucHJvcHMpO1xuXHRcdFx0fSxcblxuXHRcdFx0bWF0Y2hlczogZnVuY3Rpb24ocGF0dGVybikge1xuXHRcdFx0XHRpZiAoXy5pc1VuZGVmaW5lZChwYXR0ZXJuKSB8fCBwYXR0ZXJuLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBtb2RlbCA9IHRoaXM7XG5cdFx0XHRcdHZhciBtYXRjaGluZ1Byb3BzID0gWydmbicsICd0aXRsZScsICdvcmcnLCAnZW1haWwnLCAnbmlja25hbWUnLCAnbm90ZScsICd1cmwnLCAnY2xvdWQnLCAnYWRyJywgJ2ltcHAnLCAndGVsJ10uZmlsdGVyKGZ1bmN0aW9uIChwcm9wTmFtZSkge1xuXHRcdFx0XHRcdGlmIChtb2RlbC5wcm9wc1twcm9wTmFtZV0pIHtcblx0XHRcdFx0XHRcdHJldHVybiBtb2RlbC5wcm9wc1twcm9wTmFtZV0uZmlsdGVyKGZ1bmN0aW9uIChwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoIXByb3BlcnR5LnZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChfLmlzU3RyaW5nKHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YocGF0dGVybi50b0xvd2VyQ2FzZSgpKSAhPT0gLTE7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKF8uaXNBcnJheShwcm9wZXJ0eS52YWx1ZSkpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWUuZmlsdGVyKGZ1bmN0aW9uKHYpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB2LnRvTG93ZXJDYXNlKCkuaW5kZXhPZihwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpICE9PSAtMTtcblx0XHRcdFx0XHRcdFx0XHR9KS5sZW5ndGggPiAwO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH0pLmxlbmd0aCA+IDA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiBtYXRjaGluZ1Byb3BzLmxlbmd0aCA+IDA7XG5cdFx0XHR9XG5cblx0XHR9KTtcblxuXHRcdGlmKGFuZ3VsYXIuaXNEZWZpbmVkKHZDYXJkKSkge1xuXHRcdFx0YW5ndWxhci5leHRlbmQodGhpcy5kYXRhLCB2Q2FyZCk7XG5cdFx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLnByb3BzLCAkZmlsdGVyKCd2Q2FyZDJKU09OJykodGhpcy5kYXRhLmFkZHJlc3NEYXRhKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMucHJvcHMsIHtcblx0XHRcdFx0dmVyc2lvbjogW3t2YWx1ZTogJzMuMCd9XSxcblx0XHRcdFx0Zm46IFt7dmFsdWU6ICcnfV1cblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdH1cblxuXHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ2NhdGVnb3JpZXMnKTtcblx0XHRpZighcHJvcGVydHkpIHtcblx0XHRcdHRoaXMuY2F0ZWdvcmllcygnJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChhbmd1bGFyLmlzU3RyaW5nKHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHR0aGlzLmNhdGVnb3JpZXMoW3Byb3BlcnR5LnZhbHVlXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZhY3RvcnkoJ0FkZHJlc3NCb29rU2VydmljZScsIGZ1bmN0aW9uKERhdkNsaWVudCwgRGF2U2VydmljZSwgU2V0dGluZ3NTZXJ2aWNlLCBBZGRyZXNzQm9vaywgJHEpIHtcblxuXHR2YXIgYWRkcmVzc0Jvb2tzID0gW107XG5cdHZhciBsb2FkUHJvbWlzZSA9IHVuZGVmaW5lZDtcblxuXHR2YXIgbG9hZEFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmIChhZGRyZXNzQm9va3MubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuICRxLndoZW4oYWRkcmVzc0Jvb2tzKTtcblx0XHR9XG5cdFx0aWYgKF8uaXNVbmRlZmluZWQobG9hZFByb21pc2UpKSB7XG5cdFx0XHRsb2FkUHJvbWlzZSA9IERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdGxvYWRQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRhZGRyZXNzQm9va3MgPSBhY2NvdW50LmFkZHJlc3NCb29rcy5tYXAoZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IEFkZHJlc3NCb29rKGFkZHJlc3NCb29rKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIGxvYWRQcm9taXNlO1xuXHR9O1xuXG5cdHJldHVybiB7XG5cdFx0Z2V0QWxsOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBsb2FkQWxsKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rcztcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRnZXRHcm91cHM6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0XHRcdHJldHVybiBhZGRyZXNzQm9va3MubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuZ3JvdXBzO1xuXHRcdFx0XHR9KS5yZWR1Y2UoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0XHRcdHJldHVybiBhLmNvbmNhdChiKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Z2V0RGVmYXVsdEFkZHJlc3NCb29rOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBhZGRyZXNzQm9va3NbMF07XG5cdFx0fSxcblxuXHRcdGdldEFkZHJlc3NCb29rOiBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQuZ2V0QWRkcmVzc0Jvb2soe2Rpc3BsYXlOYW1lOmRpc3BsYXlOYW1lLCB1cmw6YWNjb3VudC5ob21lVXJsfSkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdGFkZHJlc3NCb29rID0gbmV3IEFkZHJlc3NCb29rKHtcblx0XHRcdFx0XHRcdHVybDogYWRkcmVzc0Jvb2tbMF0uaHJlZixcblx0XHRcdFx0XHRcdGRhdGE6IGFkZHJlc3NCb29rWzBdXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YWRkcmVzc0Jvb2suZGlzcGxheU5hbWUgPSBkaXNwbGF5TmFtZTtcblx0XHRcdFx0XHRyZXR1cm4gYWRkcmVzc0Jvb2s7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGNyZWF0ZTogZnVuY3Rpb24oZGlzcGxheU5hbWUpIHtcblx0XHRcdHJldHVybiBEYXZTZXJ2aWNlLnRoZW4oZnVuY3Rpb24oYWNjb3VudCkge1xuXHRcdFx0XHRyZXR1cm4gRGF2Q2xpZW50LmNyZWF0ZUFkZHJlc3NCb29rKHtkaXNwbGF5TmFtZTpkaXNwbGF5TmFtZSwgdXJsOmFjY291bnQuaG9tZVVybH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGRlbGV0ZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdHJldHVybiBEYXZTZXJ2aWNlLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQuZGVsZXRlQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2spLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dmFyIGluZGV4ID0gYWRkcmVzc0Jvb2tzLmluZGV4T2YoYWRkcmVzc0Jvb2spO1xuXHRcdFx0XHRcdGFkZHJlc3NCb29rcy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRyZW5hbWU6IGZ1bmN0aW9uKGFkZHJlc3NCb29rLCBkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQucmVuYW1lQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2ssIHtkaXNwbGF5TmFtZTpkaXNwbGF5TmFtZSwgdXJsOmFjY291bnQuaG9tZVVybH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGdldDogZnVuY3Rpb24oZGlzcGxheU5hbWUpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0XHRcdHJldHVybiBhZGRyZXNzQm9va3MuZmlsdGVyKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuZGlzcGxheU5hbWUgPT09IGRpc3BsYXlOYW1lO1xuXHRcdFx0XHR9KVswXTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRzeW5jOiBmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0cmV0dXJuIERhdkNsaWVudC5zeW5jQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2spO1xuXHRcdH0sXG5cblx0XHRzaGFyZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIHNoYXJlVHlwZSwgc2hhcmVXaXRoLCB3cml0YWJsZSwgZXhpc3RpbmdTaGFyZSkge1xuXHRcdFx0dmFyIHhtbERvYyA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZURvY3VtZW50KCcnLCAnJywgbnVsbCk7XG5cdFx0XHR2YXIgb1NoYXJlID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286c2hhcmUnKTtcblx0XHRcdG9TaGFyZS5zZXRBdHRyaWJ1dGUoJ3htbG5zOmQnLCAnREFWOicpO1xuXHRcdFx0b1NoYXJlLnNldEF0dHJpYnV0ZSgneG1sbnM6bycsICdodHRwOi8vb3duY2xvdWQub3JnL25zJyk7XG5cdFx0XHR4bWxEb2MuYXBwZW5kQ2hpbGQob1NoYXJlKTtcblxuXHRcdFx0dmFyIG9TZXQgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzZXQnKTtcblx0XHRcdG9TaGFyZS5hcHBlbmRDaGlsZChvU2V0KTtcblxuXHRcdFx0dmFyIGRIcmVmID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ2Q6aHJlZicpO1xuXHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdGRIcmVmLnRleHRDb250ZW50ID0gJ3ByaW5jaXBhbDpwcmluY2lwYWxzL3VzZXJzLyc7XG5cdFx0XHR9IGVsc2UgaWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCkge1xuXHRcdFx0XHRkSHJlZi50ZXh0Q29udGVudCA9ICdwcmluY2lwYWw6cHJpbmNpcGFscy9ncm91cHMvJztcblx0XHRcdH1cblx0XHRcdGRIcmVmLnRleHRDb250ZW50ICs9IHNoYXJlV2l0aDtcblx0XHRcdG9TZXQuYXBwZW5kQ2hpbGQoZEhyZWYpO1xuXG5cdFx0XHR2YXIgb1N1bW1hcnkgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzdW1tYXJ5Jyk7XG5cdFx0XHRvU3VtbWFyeS50ZXh0Q29udGVudCA9IHQoJ2NvbnRhY3RzJywgJ3thZGRyZXNzYm9va30gc2hhcmVkIGJ5IHtvd25lcn0nLCB7XG5cdFx0XHRcdGFkZHJlc3Nib29rOiBhZGRyZXNzQm9vay5kaXNwbGF5TmFtZSxcblx0XHRcdFx0b3duZXI6IGFkZHJlc3NCb29rLm93bmVyXG5cdFx0XHR9KTtcblx0XHRcdG9TZXQuYXBwZW5kQ2hpbGQob1N1bW1hcnkpO1xuXG5cdFx0XHRpZiAod3JpdGFibGUpIHtcblx0XHRcdFx0dmFyIG9SVyA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnJlYWQtd3JpdGUnKTtcblx0XHRcdFx0b1NldC5hcHBlbmRDaGlsZChvUlcpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgYm9keSA9IG9TaGFyZS5vdXRlckhUTUw7XG5cblx0XHRcdHJldHVybiBEYXZDbGllbnQueGhyLnNlbmQoXG5cdFx0XHRcdGRhdi5yZXF1ZXN0LmJhc2ljKHttZXRob2Q6ICdQT1NUJywgZGF0YTogYm9keX0pLFxuXHRcdFx0XHRhZGRyZXNzQm9vay51cmxcblx0XHRcdCkudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAocmVzcG9uc2Uuc3RhdHVzID09PSAyMDApIHtcblx0XHRcdFx0XHRpZiAoIWV4aXN0aW5nU2hhcmUpIHtcblx0XHRcdFx0XHRcdGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUikge1xuXHRcdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLnVzZXJzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBzaGFyZVdpdGgsXG5cdFx0XHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHR3cml0YWJsZTogd3JpdGFibGVcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCkge1xuXHRcdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLmdyb3Vwcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRpZDogc2hhcmVXaXRoLFxuXHRcdFx0XHRcdFx0XHRcdGRpc3BsYXluYW1lOiBzaGFyZVdpdGgsXG5cdFx0XHRcdFx0XHRcdFx0d3JpdGFibGU6IHdyaXRhYmxlXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9LFxuXG5cdFx0dW5zaGFyZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIHNoYXJlVHlwZSwgc2hhcmVXaXRoKSB7XG5cdFx0XHR2YXIgeG1sRG9jID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlRG9jdW1lbnQoJycsICcnLCBudWxsKTtcblx0XHRcdHZhciBvU2hhcmUgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzaGFyZScpO1xuXHRcdFx0b1NoYXJlLnNldEF0dHJpYnV0ZSgneG1sbnM6ZCcsICdEQVY6Jyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpvJywgJ2h0dHA6Ly9vd25jbG91ZC5vcmcvbnMnKTtcblx0XHRcdHhtbERvYy5hcHBlbmRDaGlsZChvU2hhcmUpO1xuXG5cdFx0XHR2YXIgb1JlbW92ZSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnJlbW92ZScpO1xuXHRcdFx0b1NoYXJlLmFwcGVuZENoaWxkKG9SZW1vdmUpO1xuXG5cdFx0XHR2YXIgZEhyZWYgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnZDpocmVmJyk7XG5cdFx0XHRpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIpIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvdXNlcnMvJztcblx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdGRIcmVmLnRleHRDb250ZW50ID0gJ3ByaW5jaXBhbDpwcmluY2lwYWxzL2dyb3Vwcy8nO1xuXHRcdFx0fVxuXHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgKz0gc2hhcmVXaXRoO1xuXHRcdFx0b1JlbW92ZS5hcHBlbmRDaGlsZChkSHJlZik7XG5cdFx0XHR2YXIgYm9keSA9IG9TaGFyZS5vdXRlckhUTUw7XG5cblxuXHRcdFx0cmV0dXJuIERhdkNsaWVudC54aHIuc2VuZChcblx0XHRcdFx0ZGF2LnJlcXVlc3QuYmFzaWMoe21ldGhvZDogJ1BPU1QnLCBkYXRhOiBib2R5fSksXG5cdFx0XHRcdGFkZHJlc3NCb29rLnVybFxuXHRcdFx0KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDIwMCkge1xuXHRcdFx0XHRcdGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUikge1xuXHRcdFx0XHRcdFx0YWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2VycyA9IGFkZHJlc3NCb29rLnNoYXJlZFdpdGgudXNlcnMuZmlsdGVyKGZ1bmN0aW9uKHVzZXIpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVzZXIuaWQgIT09IHNoYXJlV2l0aDtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLmdyb3VwcyA9IGFkZHJlc3NCb29rLnNoYXJlZFdpdGguZ3JvdXBzLmZpbHRlcihmdW5jdGlvbihncm91cHMpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGdyb3Vwcy5pZCAhPT0gc2hhcmVXaXRoO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vdG9kbyAtIHJlbW92ZSBlbnRyeSBmcm9tIGFkZHJlc3Nib29rIG9iamVjdFxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9XG5cblxuXHR9O1xuXG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uc2VydmljZSgnQ29udGFjdFNlcnZpY2UnLCBmdW5jdGlvbihEYXZDbGllbnQsIEFkZHJlc3NCb29rU2VydmljZSwgQ29udGFjdCwgJHEsIENhY2hlRmFjdG9yeSwgdXVpZDQpIHtcblxuXHR2YXIgY2FjaGVGaWxsZWQgPSBmYWxzZTtcblxuXHR2YXIgY29udGFjdHMgPSBDYWNoZUZhY3RvcnkoJ2NvbnRhY3RzJyk7XG5cblx0dmFyIG9ic2VydmVyQ2FsbGJhY2tzID0gW107XG5cblx0dmFyIGxvYWRQcm9taXNlID0gdW5kZWZpbmVkO1xuXG5cdHRoaXMucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRvYnNlcnZlckNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcblx0fTtcblxuXHR2YXIgbm90aWZ5T2JzZXJ2ZXJzID0gZnVuY3Rpb24oZXZlbnROYW1lLCB1aWQpIHtcblx0XHR2YXIgZXYgPSB7XG5cdFx0XHRldmVudDogZXZlbnROYW1lLFxuXHRcdFx0dWlkOiB1aWQsXG5cdFx0XHRjb250YWN0czogY29udGFjdHMudmFsdWVzKClcblx0XHR9O1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChvYnNlcnZlckNhbGxiYWNrcywgZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGV2KTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmZpbGxDYWNoZSA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmIChfLmlzVW5kZWZpbmVkKGxvYWRQcm9taXNlKSkge1xuXHRcdFx0bG9hZFByb21pc2UgPSBBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWxsKCkudGhlbihmdW5jdGlvbiAoZW5hYmxlZEFkZHJlc3NCb29rcykge1xuXHRcdFx0XHR2YXIgcHJvbWlzZXMgPSBbXTtcblx0XHRcdFx0ZW5hYmxlZEFkZHJlc3NCb29rcy5mb3JFYWNoKGZ1bmN0aW9uIChhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdHByb21pc2VzLnB1c2goXG5cdFx0XHRcdFx0XHRBZGRyZXNzQm9va1NlcnZpY2Uuc3luYyhhZGRyZXNzQm9vaykudGhlbihmdW5jdGlvbiAoYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgaSBpbiBhZGRyZXNzQm9vay5vYmplY3RzKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGFkZHJlc3NCb29rLm9iamVjdHNbaV0uYWRkcmVzc0RhdGEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBjb250YWN0ID0gbmV3IENvbnRhY3QoYWRkcmVzc0Jvb2ssIGFkZHJlc3NCb29rLm9iamVjdHNbaV0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGFjdHMucHV0KGNvbnRhY3QudWlkKCksIGNvbnRhY3QpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBjdXN0b20gY29uc29sZVxuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0ludmFsaWQgY29udGFjdCByZWNlaXZlZDogJyArIGFkZHJlc3NCb29rLm9iamVjdHNbaV0udXJsKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiAkcS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGNhY2hlRmlsbGVkID0gdHJ1ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIGxvYWRQcm9taXNlO1xuXHR9O1xuXG5cdHRoaXMuZ2V0QWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYoY2FjaGVGaWxsZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5maWxsQ2FjaGUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udGFjdHMudmFsdWVzKCk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuICRxLndoZW4oY29udGFjdHMudmFsdWVzKCkpO1xuXHRcdH1cblx0fTtcblxuXHR0aGlzLmdldEdyb3VwcyA9IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3RzKSB7XG5cdFx0XHRyZXR1cm4gXy51bmlxKGNvbnRhY3RzLm1hcChmdW5jdGlvbiAoZWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudC5jYXRlZ29yaWVzKCk7XG5cdFx0XHR9KS5yZWR1Y2UoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0XHRyZXR1cm4gYS5jb25jYXQoYik7XG5cdFx0XHR9LCBbXSkuc29ydCgpLCB0cnVlKTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmdldEJ5SWQgPSBmdW5jdGlvbih1aWQpIHtcblx0XHRpZihjYWNoZUZpbGxlZCA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbGxDYWNoZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb250YWN0cy5nZXQodWlkKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gJHEud2hlbihjb250YWN0cy5nZXQodWlkKSk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuY3JlYXRlID0gZnVuY3Rpb24obmV3Q29udGFjdCwgYWRkcmVzc0Jvb2ssIHVpZCkge1xuXHRcdGFkZHJlc3NCb29rID0gYWRkcmVzc0Jvb2sgfHwgQWRkcmVzc0Jvb2tTZXJ2aWNlLmdldERlZmF1bHRBZGRyZXNzQm9vaygpO1xuXHRcdG5ld0NvbnRhY3QgPSBuZXdDb250YWN0IHx8IG5ldyBDb250YWN0KGFkZHJlc3NCb29rKTtcblx0XHR2YXIgbmV3VWlkID0gJyc7XG5cdFx0aWYodXVpZDQudmFsaWRhdGUodWlkKSkge1xuXHRcdFx0bmV3VWlkID0gdWlkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRuZXdVaWQgPSB1dWlkNC5nZW5lcmF0ZSgpO1xuXHRcdH1cblx0XHRuZXdDb250YWN0LnVpZChuZXdVaWQpO1xuXHRcdG5ld0NvbnRhY3Quc2V0VXJsKGFkZHJlc3NCb29rLCBuZXdVaWQpO1xuXHRcdG5ld0NvbnRhY3QuYWRkcmVzc0Jvb2tJZCA9IGFkZHJlc3NCb29rLmRpc3BsYXlOYW1lO1xuXHRcdGlmIChfLmlzVW5kZWZpbmVkKG5ld0NvbnRhY3QuZnVsbE5hbWUoKSkgfHwgbmV3Q29udGFjdC5mdWxsTmFtZSgpID09PSAnJykge1xuXHRcdFx0bmV3Q29udGFjdC5mdWxsTmFtZSh0KCdjb250YWN0cycsICdOZXcgY29udGFjdCcpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gRGF2Q2xpZW50LmNyZWF0ZUNhcmQoXG5cdFx0XHRhZGRyZXNzQm9vayxcblx0XHRcdHtcblx0XHRcdFx0ZGF0YTogbmV3Q29udGFjdC5kYXRhLmFkZHJlc3NEYXRhLFxuXHRcdFx0XHRmaWxlbmFtZTogbmV3VWlkICsgJy52Y2YnXG5cdFx0XHR9XG5cdFx0KS50aGVuKGZ1bmN0aW9uKHhocikge1xuXHRcdFx0bmV3Q29udGFjdC5zZXRFVGFnKHhoci5nZXRSZXNwb25zZUhlYWRlcignRVRhZycpKTtcblx0XHRcdGNvbnRhY3RzLnB1dChuZXdVaWQsIG5ld0NvbnRhY3QpO1xuXHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCdjcmVhdGUnLCBuZXdVaWQpO1xuXHRcdFx0cmV0dXJuIG5ld0NvbnRhY3Q7XG5cdFx0fSkuY2F0Y2goZnVuY3Rpb24oeGhyKSB7XG5cdFx0XHR2YXIgbXNnID0gdCgnY29udGFjdHMnLCAnQ29udGFjdCBjb3VsZCBub3QgYmUgY3JlYXRlZC4nKTtcblx0XHRcdGlmICghYW5ndWxhci5pc1VuZGVmaW5lZCh4aHIpICYmICFhbmd1bGFyLmlzVW5kZWZpbmVkKHhoci5yZXNwb25zZVhNTCkgJiYgIWFuZ3VsYXIuaXNVbmRlZmluZWQoeGhyLnJlc3BvbnNlWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lTlMoJ2h0dHA6Ly9zYWJyZWRhdi5vcmcvbnMnLCAnbWVzc2FnZScpKSkge1xuXHRcdFx0XHRpZiAoJCh4aHIucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWVOUygnaHR0cDovL3NhYnJlZGF2Lm9yZy9ucycsICdtZXNzYWdlJykpLnRleHQoKSkge1xuXHRcdFx0XHRcdG1zZyA9ICQoeGhyLnJlc3BvbnNlWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lTlMoJ2h0dHA6Ly9zYWJyZWRhdi5vcmcvbnMnLCAnbWVzc2FnZScpKS50ZXh0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0T0MuTm90aWZpY2F0aW9uLnNob3dUZW1wb3JhcnkobXNnKTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmltcG9ydCA9IGZ1bmN0aW9uKGRhdGEsIHR5cGUsIGFkZHJlc3NCb29rLCBwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0YWRkcmVzc0Jvb2sgPSBhZGRyZXNzQm9vayB8fCBBZGRyZXNzQm9va1NlcnZpY2UuZ2V0RGVmYXVsdEFkZHJlc3NCb29rKCk7XG5cblx0XHR2YXIgcmVnZXhwID0gL0JFR0lOOlZDQVJEW1xcc1xcU10qP0VORDpWQ0FSRC9tZ2k7XG5cdFx0dmFyIHNpbmdsZVZDYXJkcyA9IGRhdGEubWF0Y2gocmVnZXhwKTtcblxuXHRcdGlmICghc2luZ2xlVkNhcmRzKSB7XG5cdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdObyBjb250YWN0cyBpbiBmaWxlLiBPbmx5IFZDYXJkIGZpbGVzIGFyZSBhbGxvd2VkLicpKTtcblx0XHRcdGlmIChwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0XHRcdHByb2dyZXNzQ2FsbGJhY2soMSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhciBudW0gPSAxO1xuXHRcdGZvcih2YXIgaSBpbiBzaW5nbGVWQ2FyZHMpIHtcblx0XHRcdHZhciBuZXdDb250YWN0ID0gbmV3IENvbnRhY3QoYWRkcmVzc0Jvb2ssIHthZGRyZXNzRGF0YTogc2luZ2xlVkNhcmRzW2ldfSk7XG5cdFx0XHRpZiAoWyczLjAnLCAnNC4wJ10uaW5kZXhPZihuZXdDb250YWN0LnZlcnNpb24oKSkgPCAwKSB7XG5cdFx0XHRcdGlmIChwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayhudW0gLyBzaW5nbGVWQ2FyZHMubGVuZ3RoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdPbmx5IFZDYXJkIHZlcnNpb24gNC4wIChSRkM2MzUwKSBvciB2ZXJzaW9uIDMuMCAoUkZDMjQyNikgYXJlIHN1cHBvcnRlZC4nKSk7XG5cdFx0XHRcdG51bSsrO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuY3JlYXRlKG5ld0NvbnRhY3QsIGFkZHJlc3NCb29rKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBVcGRhdGUgdGhlIHByb2dyZXNzIGluZGljYXRvclxuXHRcdFx0XHRpZiAocHJvZ3Jlc3NDYWxsYmFjaykge1xuXHRcdFx0XHRcdHByb2dyZXNzQ2FsbGJhY2sobnVtIC8gc2luZ2xlVkNhcmRzLmxlbmd0aCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bnVtKys7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5tb3ZlQ29udGFjdCA9IGZ1bmN0aW9uIChjb250YWN0LCBhZGRyZXNzYm9vaykge1xuXHRcdGlmIChjb250YWN0LmFkZHJlc3NCb29rSWQgPT09IGFkZHJlc3Nib29rLmRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnRhY3Quc3luY1ZDYXJkKCk7XG5cdFx0dmFyIGNsb25lID0gYW5ndWxhci5jb3B5KGNvbnRhY3QpO1xuXHRcdHZhciB1aWQgPSBjb250YWN0LnVpZCgpO1xuXG5cdFx0Ly8gZGVsZXRlIHRoZSBvbGQgb25lIGJlZm9yZSB0byBhdm9pZCBjb25mbGljdFxuXHRcdHRoaXMuZGVsZXRlKGNvbnRhY3QpO1xuXG5cdFx0Ly8gY3JlYXRlIHRoZSBjb250YWN0IGluIHRoZSBuZXcgdGFyZ2V0IGFkZHJlc3Nib29rXG5cdFx0dGhpcy5jcmVhdGUoY2xvbmUsIGFkZHJlc3Nib29rLCB1aWQpO1xuXHR9O1xuXG5cdHRoaXMudXBkYXRlID0gZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdC8vIHVwZGF0ZSByZXYgZmllbGRcblx0XHRjb250YWN0LnN5bmNWQ2FyZCgpO1xuXG5cdFx0Ly8gdXBkYXRlIGNvbnRhY3Qgb24gc2VydmVyXG5cdFx0cmV0dXJuIERhdkNsaWVudC51cGRhdGVDYXJkKGNvbnRhY3QuZGF0YSwge2pzb246IHRydWV9KS50aGVuKGZ1bmN0aW9uKHhocikge1xuXHRcdFx0dmFyIG5ld0V0YWcgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0VUYWcnKTtcblx0XHRcdGNvbnRhY3Quc2V0RVRhZyhuZXdFdGFnKTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygndXBkYXRlJywgY29udGFjdC51aWQoKSk7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5kZWxldGUgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0Ly8gZGVsZXRlIGNvbnRhY3QgZnJvbSBzZXJ2ZXJcblx0XHRyZXR1cm4gRGF2Q2xpZW50LmRlbGV0ZUNhcmQoY29udGFjdC5kYXRhKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0Y29udGFjdHMucmVtb3ZlKGNvbnRhY3QudWlkKCkpO1xuXHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCdkZWxldGUnLCBjb250YWN0LnVpZCgpKTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdEYXZDbGllbnQnLCBmdW5jdGlvbigpIHtcblx0dmFyIHhociA9IG5ldyBkYXYudHJhbnNwb3J0LkJhc2ljKFxuXHRcdG5ldyBkYXYuQ3JlZGVudGlhbHMoKVxuXHQpO1xuXHRyZXR1cm4gbmV3IGRhdi5DbGllbnQoeGhyKTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdEYXZTZXJ2aWNlJywgZnVuY3Rpb24oRGF2Q2xpZW50KSB7XG5cdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQWNjb3VudCh7XG5cdFx0c2VydmVyOiBPQy5saW5rVG9SZW1vdGUoJ2Rhdi9hZGRyZXNzYm9va3MnKSxcblx0XHRhY2NvdW50VHlwZTogJ2NhcmRkYXYnLFxuXHRcdHVzZVByb3ZpZGVkUGF0aDogdHJ1ZVxuXHR9KTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTZWFyY2hTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG5cdHZhciBzZWFyY2hUZXJtID0gJyc7XG5cblx0dmFyIG9ic2VydmVyQ2FsbGJhY2tzID0gW107XG5cblx0dGhpcy5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdG9ic2VydmVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHR9O1xuXG5cdHZhciBub3RpZnlPYnNlcnZlcnMgPSBmdW5jdGlvbihldmVudE5hbWUpIHtcblx0XHR2YXIgZXYgPSB7XG5cdFx0XHRldmVudDpldmVudE5hbWUsXG5cdFx0XHRzZWFyY2hUZXJtOnNlYXJjaFRlcm1cblx0XHR9O1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChvYnNlcnZlckNhbGxiYWNrcywgZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGV2KTtcblx0XHR9KTtcblx0fTtcblxuXHR2YXIgU2VhcmNoUHJveHkgPSB7XG5cdFx0YXR0YWNoOiBmdW5jdGlvbihzZWFyY2gpIHtcblx0XHRcdHNlYXJjaC5zZXRGaWx0ZXIoJ2NvbnRhY3RzJywgdGhpcy5maWx0ZXJQcm94eSk7XG5cdFx0fSxcblx0XHRmaWx0ZXJQcm94eTogZnVuY3Rpb24ocXVlcnkpIHtcblx0XHRcdHNlYXJjaFRlcm0gPSBxdWVyeTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygnY2hhbmdlU2VhcmNoJyk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZ2V0U2VhcmNoVGVybSA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzZWFyY2hUZXJtO1xuXHR9O1xuXG5cdHRoaXMuY2xlYW5TZWFyY2ggPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoJCgnLnNlYXJjaGJveCcpKSkge1xuXHRcdFx0JCgnLnNlYXJjaGJveCcpWzBdLnJlc2V0KCk7XG5cdFx0fVxuXHRcdHNlYXJjaFRlcm0gPSAnJztcblx0fTtcblxuXHRpZiAoIV8uaXNVbmRlZmluZWQoT0MuUGx1Z2lucykpIHtcblx0XHRPQy5QbHVnaW5zLnJlZ2lzdGVyKCdPQ0EuU2VhcmNoJywgU2VhcmNoUHJveHkpO1xuXHRcdGlmICghXy5pc1VuZGVmaW5lZChPQ0EuU2VhcmNoKSkge1xuXHRcdFx0T0MuU2VhcmNoID0gbmV3IE9DQS5TZWFyY2goJCgnI3NlYXJjaGJveCcpLCAkKCcjc2VhcmNocmVzdWx0cycpKTtcblx0XHRcdCQoJyNzZWFyY2hib3gnKS5zaG93KCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFfLmlzVW5kZWZpbmVkKCQoJy5zZWFyY2hib3gnKSkpIHtcblx0XHQkKCcuc2VhcmNoYm94JylbMF0uYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRpZihlLmtleUNvZGUgPT09IDEzKSB7XG5cdFx0XHRcdG5vdGlmeU9ic2VydmVycygnc3VibWl0U2VhcmNoJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTZXR0aW5nc1NlcnZpY2UnLCBmdW5jdGlvbigpIHtcblx0dmFyIHNldHRpbmdzID0ge1xuXHRcdGFkZHJlc3NCb29rczogW1xuXHRcdFx0J3Rlc3RBZGRyJ1xuXHRcdF1cblx0fTtcblxuXHR0aGlzLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0XHRzZXR0aW5nc1trZXldID0gdmFsdWU7XG5cdH07XG5cblx0dGhpcy5nZXQgPSBmdW5jdGlvbihrZXkpIHtcblx0XHRyZXR1cm4gc2V0dGluZ3Nba2V5XTtcblx0fTtcblxuXHR0aGlzLmdldEFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzZXR0aW5ncztcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCd2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG5cdC8qKlxuXHQgKiBtYXAgdkNhcmQgYXR0cmlidXRlcyB0byBpbnRlcm5hbCBhdHRyaWJ1dGVzXG5cdCAqXG5cdCAqIHByb3BOYW1lOiB7XG5cdCAqIFx0XHRtdWx0aXBsZTogW0Jvb2xlYW5dLCAvLyBpcyB0aGlzIHByb3AgYWxsb3dlZCBtb3JlIHRoYW4gb25jZT8gKGRlZmF1bHQgPSBmYWxzZSlcblx0ICogXHRcdHJlYWRhYmxlTmFtZTogW1N0cmluZ10sIC8vIGludGVybmF0aW9uYWxpemVkIHJlYWRhYmxlIG5hbWUgb2YgcHJvcFxuXHQgKiBcdFx0dGVtcGxhdGU6IFtTdHJpbmddLCAvLyB0ZW1wbGF0ZSBuYW1lIGZvdW5kIGluIC90ZW1wbGF0ZXMvZGV0YWlsSXRlbXNcblx0ICogXHRcdFsuLi5dIC8vIG9wdGlvbmFsIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gd2hpY2ggbWlnaHQgZ2V0IHVzZWQgYnkgdGhlIHRlbXBsYXRlXG5cdCAqIH1cblx0ICovXG5cdHRoaXMudkNhcmRNZXRhID0ge1xuXHRcdG5pY2tuYW1lOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ05pY2tuYW1lJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnXG5cdFx0fSxcblx0XHRuOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0RldGFpbGVkIG5hbWUnKSxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJycsICcnLCAnJywgJycsICcnXVxuXHRcdFx0fSxcblx0XHRcdHRlbXBsYXRlOiAnbidcblx0XHR9LFxuXHRcdG5vdGU6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnTm90ZXMnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dGFyZWEnXG5cdFx0fSxcblx0XHR1cmw6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdXZWJzaXRlJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3VybCdcblx0XHR9LFxuXHRcdGNsb3VkOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnRmVkZXJhdGVkIENsb3VkIElEJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSycsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ09USEVSJywgbmFtZTogdCgnY29udGFjdHMnLCAnT3RoZXInKX1cblx0XHRcdF1cdFx0fSxcblx0XHRhZHI6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdBZGRyZXNzJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2FkcicsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnLCAnJywgJycsICcnLCAnJywgJycsICcnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0Y2F0ZWdvcmllczoge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdHcm91cHMnKSxcblx0XHRcdHRlbXBsYXRlOiAnZ3JvdXBzJ1xuXHRcdH0sXG5cdFx0YmRheToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdCaXJ0aGRheScpLFxuXHRcdFx0dGVtcGxhdGU6ICdkYXRlJ1xuXHRcdH0sXG5cdFx0YW5uaXZlcnNhcnk6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnQW5uaXZlcnNhcnknKSxcblx0XHRcdHRlbXBsYXRlOiAnZGF0ZSdcblx0XHR9LFxuXHRcdGRlYXRoZGF0ZToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdEYXRlIG9mIGRlYXRoJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2RhdGUnXG5cdFx0fSxcblx0XHRlbWFpbDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0VtYWlsJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOicnLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUksnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdPVEhFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ090aGVyJyl9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHRpbXBwOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnSW5zdGFudCBtZXNzYWdpbmcnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0dGVsOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnUGhvbmUnKSxcblx0XHRcdHRlbXBsYXRlOiAndGVsJyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSxWT0lDRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRSxWT0lDRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUkssVk9JQ0UnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdDRUxMJywgbmFtZTogdCgnY29udGFjdHMnLCAnTW9iaWxlJyl9LFxuXHRcdFx0XHR7aWQ6ICdGQVgnLCBuYW1lOiB0KCdjb250YWN0cycsICdGYXgnKX0sXG5cdFx0XHRcdHtpZDogJ0hPTUUsRkFYJywgbmFtZTogdCgnY29udGFjdHMnLCAnRmF4IGhvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUkssRkFYJywgbmFtZTogdCgnY29udGFjdHMnLCAnRmF4IHdvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ1BBR0VSJywgbmFtZTogdCgnY29udGFjdHMnLCAnUGFnZXInKX0sXG5cdFx0XHRcdHtpZDogJ1ZPSUNFJywgbmFtZTogdCgnY29udGFjdHMnLCAnVm9pY2UnKX1cblx0XHRcdF1cblx0XHR9LFxuXHRcdCdYLVNPQ0lBTFBST0ZJTEUnOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnU29jaWFsIG5ldHdvcmsnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ2ZhY2Vib29rJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdGQUNFQk9PSycsIG5hbWU6ICdGYWNlYm9vayd9LFxuXHRcdFx0XHR7aWQ6ICdUV0lUVEVSJywgbmFtZTogJ1R3aXR0ZXInfVxuXHRcdFx0XVxuXG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZmllbGRPcmRlciA9IFtcblx0XHQnb3JnJyxcblx0XHQndGl0bGUnLFxuXHRcdCd0ZWwnLFxuXHRcdCdlbWFpbCcsXG5cdFx0J2FkcicsXG5cdFx0J2ltcHAnLFxuXHRcdCduaWNrJyxcblx0XHQnYmRheScsXG5cdFx0J2Fubml2ZXJzYXJ5Jyxcblx0XHQnZGVhdGhkYXRlJyxcblx0XHQndXJsJyxcblx0XHQnWC1TT0NJQUxQUk9GSUxFJyxcblx0XHQnbm90ZScsXG5cdFx0J2NhdGVnb3JpZXMnLFxuXHRcdCdyb2xlJ1xuXHRdO1xuXG5cdHRoaXMuZmllbGREZWZpbml0aW9ucyA9IFtdO1xuXHRmb3IgKHZhciBwcm9wIGluIHRoaXMudkNhcmRNZXRhKSB7XG5cdFx0dGhpcy5maWVsZERlZmluaXRpb25zLnB1c2goe2lkOiBwcm9wLCBuYW1lOiB0aGlzLnZDYXJkTWV0YVtwcm9wXS5yZWFkYWJsZU5hbWUsIG11bHRpcGxlOiAhIXRoaXMudkNhcmRNZXRhW3Byb3BdLm11bHRpcGxlfSk7XG5cdH1cblxuXHR0aGlzLmZhbGxiYWNrTWV0YSA9IGZ1bmN0aW9uKHByb3BlcnR5KSB7XG5cdFx0ZnVuY3Rpb24gY2FwaXRhbGl6ZShzdHJpbmcpIHsgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTsgfVxuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lOiAndW5rbm93bi0nICsgcHJvcGVydHksXG5cdFx0XHRyZWFkYWJsZU5hbWU6IGNhcGl0YWxpemUocHJvcGVydHkpLFxuXHRcdFx0dGVtcGxhdGU6ICdoaWRkZW4nLFxuXHRcdFx0bmVjZXNzaXR5OiAnb3B0aW9uYWwnXG5cdFx0fTtcblx0fTtcblxuXHR0aGlzLmdldE1ldGEgPSBmdW5jdGlvbihwcm9wZXJ0eSkge1xuXHRcdHJldHVybiB0aGlzLnZDYXJkTWV0YVtwcm9wZXJ0eV0gfHwgdGhpcy5mYWxsYmFja01ldGEocHJvcGVydHkpO1xuXHR9O1xuXG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdKU09OMnZDYXJkJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihpbnB1dCkge1xuXHRcdHJldHVybiB2Q2FyZC5nZW5lcmF0ZShpbnB1dCk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdjb250YWN0Q29sb3InLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0Ly8gQ2hlY2sgaWYgY29yZSBoYXMgdGhlIG5ldyBjb2xvciBnZW5lcmF0b3Jcblx0XHRpZih0eXBlb2YgaW5wdXQudG9Ic2wgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHZhciBoc2wgPSBpbnB1dC50b0hzbCgpO1xuXHRcdFx0cmV0dXJuICdoc2woJytoc2xbMF0rJywgJytoc2xbMV0rJyUsICcraHNsWzJdKyclKSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIElmIG5vdCwgd2UgdXNlIHRoZSBvbGQgb25lXG5cdFx0XHQvKiBnbG9iYWwgbWQ1ICovXG5cdFx0XHR2YXIgaGFzaCA9IG1kNShpbnB1dCkuc3Vic3RyaW5nKDAsIDQpLFxuXHRcdFx0XHRtYXhSYW5nZSA9IHBhcnNlSW50KCdmZmZmJywgMTYpLFxuXHRcdFx0XHRodWUgPSBwYXJzZUludChoYXNoLCAxNikgLyBtYXhSYW5nZSAqIDI1Njtcblx0XHRcdHJldHVybiAnaHNsKCcgKyBodWUgKyAnLCA5MCUsIDY1JSknO1xuXHRcdH1cblx0fTtcbn0pOyIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdjb250YWN0R3JvdXBGaWx0ZXInLCBmdW5jdGlvbigpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRyZXR1cm4gZnVuY3Rpb24gKGNvbnRhY3RzLCBncm91cCkge1xuXHRcdGlmICh0eXBlb2YgY29udGFjdHMgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gY29udGFjdHM7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgZ3JvdXAgPT09ICd1bmRlZmluZWQnIHx8IGdyb3VwLnRvTG93ZXJDYXNlKCkgPT09IHQoJ2NvbnRhY3RzJywgJ0FsbCBjb250YWN0cycpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiBjb250YWN0cztcblx0XHR9XG5cdFx0dmFyIGZpbHRlciA9IFtdO1xuXHRcdGlmIChjb250YWN0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNvbnRhY3RzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChncm91cC50b0xvd2VyQ2FzZSgpID09PSB0KCdjb250YWN0cycsICdOb3QgZ3JvdXBlZCcpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdFx0XHRpZiAoY29udGFjdHNbaV0uY2F0ZWdvcmllcygpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0ZmlsdGVyLnB1c2goY29udGFjdHNbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoY29udGFjdHNbaV0uY2F0ZWdvcmllcygpLmluZGV4T2YoZ3JvdXApID49IDApIHtcblx0XHRcdFx0XHRcdGZpbHRlci5wdXNoKGNvbnRhY3RzW2ldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZpbHRlcjtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2ZpZWxkRmlsdGVyJywgZnVuY3Rpb24oKSB7XG5cdCd1c2Ugc3RyaWN0Jztcblx0cmV0dXJuIGZ1bmN0aW9uIChmaWVsZHMsIGNvbnRhY3QpIHtcblx0XHRpZiAodHlwZW9mIGZpZWxkcyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBmaWVsZHM7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgY29udGFjdCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBmaWVsZHM7XG5cdFx0fVxuXHRcdHZhciBmaWx0ZXIgPSBbXTtcblx0XHRpZiAoZmllbGRzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChmaWVsZHNbaV0ubXVsdGlwbGUgKSB7XG5cdFx0XHRcdFx0ZmlsdGVyLnB1c2goZmllbGRzW2ldKTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoXy5pc1VuZGVmaW5lZChjb250YWN0LmdldFByb3BlcnR5KGZpZWxkc1tpXS5pZCkpKSB7XG5cdFx0XHRcdFx0ZmlsdGVyLnB1c2goZmllbGRzW2ldKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmlsdGVyO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignZmlyc3RDaGFyYWN0ZXInLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIGlucHV0LmNoYXJBdCgwKTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2xvY2FsZU9yZGVyQnknLCBbZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24gKGFycmF5LCBzb3J0UHJlZGljYXRlLCByZXZlcnNlT3JkZXIpIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXkpKSByZXR1cm4gYXJyYXk7XG5cdFx0aWYgKCFzb3J0UHJlZGljYXRlKSByZXR1cm4gYXJyYXk7XG5cblx0XHR2YXIgYXJyYXlDb3B5ID0gW107XG5cdFx0YW5ndWxhci5mb3JFYWNoKGFycmF5LCBmdW5jdGlvbiAoaXRlbSkge1xuXHRcdFx0YXJyYXlDb3B5LnB1c2goaXRlbSk7XG5cdFx0fSk7XG5cblx0XHRhcnJheUNvcHkuc29ydChmdW5jdGlvbiAoYSwgYikge1xuXHRcdFx0dmFyIHZhbHVlQSA9IGFbc29ydFByZWRpY2F0ZV07XG5cdFx0XHRpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHZhbHVlQSkpIHtcblx0XHRcdFx0dmFsdWVBID0gYVtzb3J0UHJlZGljYXRlXSgpO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHZhbHVlQiA9IGJbc29ydFByZWRpY2F0ZV07XG5cdFx0XHRpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHZhbHVlQikpIHtcblx0XHRcdFx0dmFsdWVCID0gYltzb3J0UHJlZGljYXRlXSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYW5ndWxhci5pc1N0cmluZyh2YWx1ZUEpKSB7XG5cdFx0XHRcdHJldHVybiAhcmV2ZXJzZU9yZGVyID8gdmFsdWVBLmxvY2FsZUNvbXBhcmUodmFsdWVCKSA6IHZhbHVlQi5sb2NhbGVDb21wYXJlKHZhbHVlQSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhbmd1bGFyLmlzTnVtYmVyKHZhbHVlQSkgfHwgYW5ndWxhci5pc0Jvb2xlYW4odmFsdWVBKSkge1xuXHRcdFx0XHRyZXR1cm4gIXJldmVyc2VPcmRlciA/IHZhbHVlQSAtIHZhbHVlQiA6IHZhbHVlQiAtIHZhbHVlQTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gYXJyYXlDb3B5O1xuXHR9O1xufV0pO1xuXG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignbmV3Q29udGFjdCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHRyZXR1cm4gaW5wdXQgIT09ICcnID8gaW5wdXQgOiB0KCdjb250YWN0cycsICdOZXcgY29udGFjdCcpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignb3JkZXJEZXRhaWxJdGVtcycsIGZ1bmN0aW9uKHZDYXJkUHJvcGVydGllc1NlcnZpY2UpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRyZXR1cm4gZnVuY3Rpb24oaXRlbXMsIGZpZWxkLCByZXZlcnNlKSB7XG5cblx0XHR2YXIgZmlsdGVyZWQgPSBbXTtcblx0XHRhbmd1bGFyLmZvckVhY2goaXRlbXMsIGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdGZpbHRlcmVkLnB1c2goaXRlbSk7XG5cdFx0fSk7XG5cblx0XHR2YXIgZmllbGRPcmRlciA9IGFuZ3VsYXIuY29weSh2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLmZpZWxkT3JkZXIpO1xuXHRcdC8vIHJldmVyc2UgdG8gbW92ZSBjdXN0b20gaXRlbXMgdG8gdGhlIGVuZCAoaW5kZXhPZiA9PSAtMSlcblx0XHRmaWVsZE9yZGVyLnJldmVyc2UoKTtcblxuXHRcdGZpbHRlcmVkLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdGlmKGZpZWxkT3JkZXIuaW5kZXhPZihhW2ZpZWxkXSkgPCBmaWVsZE9yZGVyLmluZGV4T2YoYltmaWVsZF0pKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fVxuXHRcdFx0aWYoZmllbGRPcmRlci5pbmRleE9mKGFbZmllbGRdKSA+IGZpZWxkT3JkZXIuaW5kZXhPZihiW2ZpZWxkXSkpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSk7XG5cblx0XHRpZihyZXZlcnNlKSBmaWx0ZXJlZC5yZXZlcnNlKCk7XG5cdFx0cmV0dXJuIGZpbHRlcmVkO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcigndG9BcnJheScsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG5cdFx0aWYgKCEob2JqIGluc3RhbmNlb2YgT2JqZWN0KSkgcmV0dXJuIG9iajtcblx0XHRyZXR1cm4gXy5tYXAob2JqLCBmdW5jdGlvbih2YWwsIGtleSkge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh2YWwsICcka2V5Jywge3ZhbHVlOiBrZXl9KTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ3ZDYXJkMkpTT04nLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIHZDYXJkLnBhcnNlKGlucHV0KTtcblx0fTtcbn0pO1xuIl19
