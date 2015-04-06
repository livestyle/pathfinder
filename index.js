if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	function last(arr) {
		return arr[arr.length - 1];
	}

	function flatten(arr, ctx) {
		ctx = ctx || [];
		arr.forEach(function(item) {
			Array.isArray(item) ? flatten(item, ctx) : ctx.push(item);
		});
		return ctx;
	}

	function nodeName(node) {
		return node ? (node.normalName || node.name) : null;
	}

	function SearchResult(parent, index, rest) {
		this.parent = parent;
		this.index = index;
		this.partial = !!rest;
		this.rest = rest;
	}

	Object.defineProperty(SearchResult.prototype, 'node', {
		enumerabe: true,
		get: function() {
			if (typeof this.index === 'undefined') {
				return this.parent;
			}
			return this.parent.children[this.index];
		}
	});

	/**
	 * Locates child nodes inside `ctx` that matches given 
	 * path `component`. 
	 * @param  {ResolvedNode}      ctx       Node where to search
	 * @param  {NodePathComponent} component Path component to match
	 * @param  {Object} hint       Location hint
	 * @return {Array}  List of matched nodes, ordered by matching score
	 */
	function locate(ctx, component, hint) {
		var items = ctx.children.filter(function(child) {
			return nodeName(child) === component.name;
		});

		return items.map(function(node, i) {
			var score = 0;
			if (hint) {
				score += matchesBeforeHints(node, hint.before) ? 0.5 : 0;
				score += matchesAfterHints(node, hint.after) ? 0.5 : 0;
			} else if (i === component.pos - 1) {
				score += 0.1;
			}

			return {
				node: node,
				index: i,
				score: score
			};
		});
	}

	function matchesSort(a, b) {
		return (b.score * 10000 + b.index) - (a.score * 10000 + a.index);
	}

	function matchesBeforeHints(node, hints) {
		var siblings = node.parent.children;
		var ix = siblings.indexOf(node);

		if (!hints || hints.length - 1 > ix) {
			// more hints than siblings
			return false;
		}

		if (hints.length === ix === 0) {
			// hint tells it’s a first node
			return true;
		}

		for (var i = hints.length - 1, sibling; i >= 0; i--) {
			sibling = siblings[--ix];
			if (!sibling || nodeName(sibling) !== hints[i].name) {
				return false;
			}
		}

		return true;
	}

	function matchesAfterHints(node, hints) {
		var siblings = node.parent.children;
		var ix = siblings.indexOf(node);

		if (!hints || ix + hints.length > siblings.length - 1) {
			 // more hints than siblings
			return false;
		}

		if (hints.length === 0 && ix === siblings.length - 1) {
			// hint tells it’s a last node
			return true;
		}

		for (var i = 0, il = hints.length, sibling; i < il; i++) {
			sibling = siblings[++ix];
			if (!sibling || nodeName(sibling) !== hints[i].name) {
				return false;
			}
		}

		return true;
	}

	function matchingSet(items, hints) {
		var result = [];
		if (!hints || !hints.length) {
			return result;
		}

		var hl = hints.length;
		items.forEach(function(item, i) {
			if (hints[0].name === nodeName(item)) {
				for (var j = 1; j < hl; j++) {
					if (!items[i + j] || nodeName(items[i +j]) !== hints[j].name) {
						return false;
					}
				}
				result.push(i);
			}
		});

		return result;
	};

	return {
		/**
		 * Tries to find the best insertion point for absent
		 * path nodes (or its components).
		 * @param  {ResolvedNode} tree
		 * @param  {NodePath} path
		 * @param  {Object} hints
		 * @return {Object} Object with `parent` and `index` properties
		 * pointing to matched element. The `rest` property (if present)
		 * means given path can’t be fully matched and `index` propery
		 * points to `parent` child index where the `rest` node path
		 * components should be added
		 */
		find: function(tree, path, hints) {
			if (path.toString() === '') {
				// it’s a root node
				return new SearchResult(tree);
			}

			hints = (hints || []).slice(0);
			var ctx = [tree], found;
			var components = path.components.slice(0);
			var component, hint, result;

			while (component = components.shift()) {
				hint = hints.shift();
				found = flatten(ctx.map(function(node) {
					return locate(node, component, hint);
				})).sort(matchesSort);

				found = found.filter(function(item) {
					return item.score === found[0].score;
				}).map(function(item) {
					return item.node;
				});

				if (!found.length) {
					// Component wasn’t found, which means
					// we have to create it, as well as all other
					// descendants.
					// So let’s find best insertion position, 
					// according to given hints
					components.unshift(component);
					result = last(ctx);
					return new SearchResult(result, this.indexForHint(result, hint), components);
				} else {
					ctx = found;
				}
			}

			result = last(ctx);
			return new SearchResult(result.parent, result.parent.indexOf(result));
		},

		/**
		 * Returns best insertion position inside `parent`
		 * for given hint
		 * @param  {ResolvedNode} parent
		 * @param  {Object} hint
		 * @return {Number}
		 */
		indexForHint: function(parent, hint) {
			var items = parent.children;
			if (!hint) {
				return parent.children.length;
			}

			// XXX matchingSet() returns staring index of matching subset
			// but for our purposes we actually need the ending index
			var before = matchingSet(items, hint.before).map(function(ix) {
				return ix + hint.before.length;
			});
			var after = matchingSet(items, hint.after);
			var possibleResults = [];
			if (hint.before.length && hint.after.length) {
				// we have both sets of hints, find index between them
				before.forEach(function(ix) {
					for (var i = 0, il = after.length; i < il; i++) {
						if (after[i] >= ix) {
							return possibleResults.push(after[i]);
						}
					}
				});
			} else if (hint.before.length) {
				possibleResults = before;
			} else if (hint.after.length) {
				possibleResults = after;
			}

			// insert nodes at the end by default
			return possibleResults.length ? possibleResults[0] : items.length;
		}
	};
});