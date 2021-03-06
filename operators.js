(function (root, factory) { if (typeof define === 'function' && define.amd) {
        define(['./Variable'], factory)
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./Variable'))
    } else {
        root.alkali.operators = factory(root.alkali.Variable)
    }
}(this, function (Variable) {
	var deny = Variable.deny;
	var operatingFunctions = {};
	var operators = {};
	function getOperatingFunction(expression){
		// jshint evil: true
		return operatingFunctions[expression] ||
			(operatingFunctions[expression] =
				new Function('a', 'b', 'return ' + expression));
	}
	function operator(operator, name, precedence, forward, reverseA, reverseB){
		// defines the standard operators
		var reverse = function(output, inputs){
			var a = inputs[0],
				b = inputs[1];
			if(a && a.put){
				var result = reverseA(output, b && b.valueOf());
				if(result !== deny){
					a.put(result);
				}
			}else if(b && b.put){
				b.put(reverseB(output, a && a.valueOf()));
			}else{
				return deny;
			}
		};
		// define a function that can lazily ensure the operating function
		// is available
		var operatorHandler = {
			apply: function(instance, args){
				forward = getOperatingFunction(forward);
				reverseA = reverseA && getOperatingFunction(reverseA);
				reverseB = reverseB && getOperatingFunction(reverseB);
				forward.reverse = reverse;
				operators[operator] = operatorHandler = new Variable(forward);

				addFlags(operatorHandler);
				return operatorHandler.apply(instance, args);
			}
		};
		function addFlags(operatorHandler){
			operatorHandler.precedence = precedence;
			operatorHandler.infix = reverseB !== false;
		}
		addFlags(operatorHandler);
		operators[operator] = operatorHandler;
		operators[name] = function() {
			return operatorHandler.apply(null, arguments)
		}
	}
	// using order precedence from:
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
	operator('+', 'add', 6, 'a+b', 'a-b', 'a-b');
	operator('-', 'subtract', 6, 'a-b', 'a+b', 'b-a');
	operator('*', 'multiply', 5, 'a*b', 'a/b', 'a/b');
	operator('/', 'divide', 5, 'a/b', 'a*b', 'b/a');
//	operator('^', 7, 'a^b', 'a^(-b)', 'Math.log(a)/Math.log(b)');
	operator('?', 'if', 16, 'b[a?0:1]', 'a===b[0]||(a===b[1]?false:deny)', '[a,b]');
	operator(':', 'choose', 15, '[a,b]', 'a[0]?a[1]:deny', 'a[1]');
	operator('!', 'not', 4, '!a', '!a', false);
	operator('%', 'remainder', 5, 'a%b');
	operator('>', 'greater', 8, 'a>b');
	operator('>=', 'greaterOrEqual', 8, 'a>=b');
	operator('<', 'less', 8, 'a<b');
	operator('<=', 'lessOrEqual', 8, 'a<=b');
	operator('==', 'equal', 9, 'a===b');
	operator('&', 'and', 8, 'a&&b');
	operator('|', 'or', 8, 'a||b');
	operator('round', 'round', 8, 'Math.round(a*Math.pow(10,b||1))/Math.pow(10,b||1)', 'a', 'a');
	return operators;
}));