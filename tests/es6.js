define([
	'../Element',
	'../Variable',
	'../react',
	'intern!object',
	'intern/chai!assert'
], function (Element, Variable, react, registerSuite, assert) {
	var Div = Element.Div
	registerSuite({
		name: 'es6',
		react: function () {
			var a = new Variable()
			var b = new Variable()
			var sum = react(function*() {
				return (yield a) + (yield b)
			})
			var invalidated = false
			sum.notifies({
				updated: function() {
					invalidated = true
				}
			})
			var target = new Variable()
			target.put(sum)
			var targetInvalidated = false
			target.notifies({
				updated: function() {
					targetInvalidated = true
				}
			})
			a.put(3)
			// assert.isFalse(invalidated)
			b.put(5)
			//assert.isTrue(invalidated)
			assert.equal(sum.valueOf(), 8)
			invalidated = false
			assert.equal(target.valueOf(), 8)
			targetInvalidated = false
			a.put(4)
			assert.isTrue(invalidated)
			assert.equal(sum.valueOf(), 9)
			invalidated = false
			assert.isTrue(targetInvalidated)
			assert.equal(target.valueOf(), 9)
			targetInvalidated = false
			b.put(6)
			assert.isTrue(invalidated)
			assert.equal(sum.valueOf(), 10)
			assert.isTrue(targetInvalidated)
			assert.equal(target.valueOf(), 10)

		},

		elementClass: function() {
			class MyDiv extends Div('.my-class', {title: 'my-title', wasClicked: false}) {
				onclick() {
					this.otherMethod()
				}
				otherMethod() {
					this.wasClicked = true
				}
			}
			var myDiv = new MyDiv()
			assert.isFalse(myDiv.wasClicked)
			myDiv.click()
			assert.isTrue(myDiv.wasClicked)
			class MySubDiv extends MyDiv {
				otherMethod() {
					super.otherMethod()
					this.alsoFlagged = true
				}
			}
			var mySubDiv = new MySubDiv()
			assert.isFalse(mySubDiv.wasClicked)
			mySubDiv.click()
			assert.isTrue(mySubDiv.wasClicked)
			assert.isTrue(mySubDiv.alsoFlagged)
		},
		forOf: function() {
			var arrayVariable = new Variable(['a', 'b', 'c'])
			var results = []
			for (let letter of arrayVariable) {
				results.push(letter)
			}
			assert.deepEqual(results, ['a', 'b', 'c'])
		},
		Symbol: function() {
			let mySymbol = Symbol('my')
			let obj = {
				[mySymbol]: 'test'
			}
			let v = new Variable(obj)
			assert.strictEqual(v.property(mySymbol).valueOf(), 'test')
		},
		Map: function() {
			let map = new Map()
			map.set('a', 2)
			var v = new Variable(map)
			var updated
			v.property('a').notifies({
				updated: function(){
					updated = true
				}
			})
			assert.strictEqual(v.get('a'), 2)
			updated = false
			v.set('a', 3)
			assert.strictEqual(updated, true)
			assert.strictEqual(v.get('a'), 3)
			assert.strictEqual(map.get('a'), 3)
			v.set(2, 2)
			v.set('2', 'two')
			assert.strictEqual(map.get(2), 2)
			assert.strictEqual(map.get('2'), 'two')
		},
		renderGenerator: function() {
			var a = new Variable(1)
			var b = new Variable(2)
			class GeneratorDiv extends Div {
				*render() {
					this.textContent = (yield a) + (yield b)
				}
			}
			var div = new GeneratorDiv()
			document.body.appendChild(div)
			return new Promise(requestAnimationFrame).then(function(){
				assert.strictEqual(div.textContent, '3')
				a.put(2)
				return new Promise(requestAnimationFrame).then(function(){
					assert.strictEqual(div.textContent, '4')
					b.put(3)
					return new Promise(requestAnimationFrame).then(function(){
						assert.strictEqual(div.textContent, '5')
					})
				})
			})
		}
	})
})