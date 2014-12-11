var assert = require('assert');
var livestyle = require('emmet-livestyle');
var pathfinder = require('../');

function parse(source) {
	livestyle.resolve(source, function(err, result) {
		source = result;
	});

	return source;
}

function comp(name, pos) {
	return {
		name: name,
		pos: pos || 1
	};
}

describe('Path finder', function() {
	function find(tree, path, hints) {
		var result = pathfinder.find(tree, path, hints);
		return result.partial ? null : result.node;
	}

	function findPath(tree, path, hints) {
		var result = find(tree, path, hints);
		return result ? result.path.toString() : null;
	}


	it('simple search', function() {
		var tree1 = parse('a{} b{} c{}');
		var tree2 = parse('b{} a{} b{} c{} b{}');
		var tree3 = parse('a{} b{} c{} b{}');
		var tree4 = parse('b{} a{} b{} c{}');
		var tree5 = parse('b{} b{} c{}');

		var ctx = tree1.get(1);
		var hints = [{
			before: [comp('a')],
			after:  [comp('c')]
		}];
		
		assert.equal(findPath(tree2, ctx.path, hints), 'b|2');
		assert.equal(findPath(tree3, ctx.path, hints), 'b|1');
		assert.equal(findPath(tree4, ctx.path, hints), 'b|2');
		// doesn’t match provided hints, guess from source
		assert.equal(findPath(tree5, ctx.path, hints), 'b|2');
	});

	it('match edge node', function() {
		var tree1 = parse('a{} b{} c{}');
		var tree2 = parse('b{} c{} b{} a{} b{} c{} a{} b{}');
		var ctx, hints;

		ctx = tree1.get(0);
		hints = [{
			before: [],
			after:  [comp('b'), comp('c')]
		}];
		assert.equal(pathfinder.find(tree2, ctx.path, hints).index, 3);

		ctx = tree1.get(2);
		hints = [{
			before: [comp('a'), comp('b')],
			after:  []
		}];
		assert.equal(pathfinder.find(tree2, ctx.path, hints).index, 5);
	});

	it('nested nodes', function() {
		var tree1 = parse('a{ b{} c{} d{} }');
		var tree2 = parse('g{} a{ c{} d{} b{} } g{} a{ b{} c{} d{} } g{}');
		var tree3 = parse('g{} a{ b{} c{} d{} } g{} a{ c{} d{} b{} } g{}');
		var ctx, hints, result;

		ctx = tree1.get('a').get('c');
		hints = [
			{before: [], after: []},
			{before: [comp('b')], after: [comp('d')]}
		];

		assert.equal(findPath(tree2, ctx.path, hints), 'a|2/c|1');
		assert.equal(findPath(tree3, ctx.path, hints), 'a|1/c|1');
	});

	it('sparse hint match', function() {
		var tree1 = parse('a{} b{} c{} d{} e{}');
		var tree2 = parse('a{} b{} c1{} c2{} c3{} d{} e{}');
		var tree3 = parse('d{} e{} a{} b{} c1{} c2{} c3{} d{} e{} a{} b{}');
		var ctx, hint, result;

		ctx = tree1.get('a').get('c');
		hint = {
			before: [comp('a'), comp('b')],
			after:  [comp('d'), comp('e')]
		};

		assert.equal(pathfinder.indexForHint(tree2, hint), 5);
		assert.equal(pathfinder.indexForHint(tree3, hint), 7);
	});
});