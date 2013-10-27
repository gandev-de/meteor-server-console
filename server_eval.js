var ddp;
var expressionHistory = [];
var exprCursor = 0;

var STATES = {
	UP: "--> server up <--",
	DOWN: "--> server down <--",
	_current: null
};

function jumpToPageBottom() {
	$('html, body').scrollTop($(document).height() - $(window).height());
}

$(document).ready(function() {
	var newExpression = function(expr) {
		expressionHistory = _.filter(expressionHistory, function(e) {
			return e !== expr;
		});
		expressionHistory.push(expr);
		exprCursor = expressionHistory.length - 1;
		exprCursorState = "bottom";
	};

	var typeString = function(value) {
		var type = "unknown";
		var type_style = 'style="color: ';
		if (value.____TYPE____) {
			type = value.____TYPE____;
			if (type === "[Circular]") {
				type_style += 'red;"';
			} else {
				type_style += 'blue;"';
			}
			delete value.____TYPE____;
		} else if (_.isArray(value)) {
			type = '[Array[' + value.length + ']]';
			type_style += 'orange;"';
		} else if (_.isObject(value)) {
			type = '[Object]';
			type_style += 'green;"';
		} else {
			type = 'null';
			type_style += 'red;"';
		}
		return '<span ' + type_style + '>' + type + "</span>";
	};

	var objectToTreeData = function(obj, first) {
		var tree_data = [];
		if (_.isObject(obj)) {
			for (var key in obj) {
				var value = obj[key];
				var sub_tree;
				if (_.isObject(value)) {
					sub_tree = {
						'label': key + ": " + typeString(value),
						'children': objectToTreeData(value, false)
					};
				} else {
					sub_tree = {
						'label': key + ": " + (_.isString(value) ?
							'<span style="color: rgb(210, 180, 60);">"' + value + '"</span>' :
							value)
					};
				}

				if (first) {
					var _expr = tree_data.length === 0 && tree_data.push({
						'label': typeString(obj),
						'children': []
					});
					tree_data[0].children.push(sub_tree);
				} else {
					tree_data.push(sub_tree);
				}
			}
		}
		return tree_data;
	};

	var newEntry = function(doc, _internal) {
		var result;
		if (_.isObject(doc.result)) {
			result = $('<div class="eval_trees"></div>');
			result.tree({
				data: objectToTreeData(doc.result, true),
				onCreateLi: function(node, $li) {
					// Append a link to the jqtree-element div.
					var $title = $li.find('.jqtree-title');
					$title.html($title.text());
				}
			});
		} else {
			result = $('<div>' + doc.result + '</div>');
			if (doc.error) {
				result.css("color", "red");
			}
		}

		var entry = $('<div class="result"></div>');
		if (!_internal) {
			entry.append($('<div class="eval_expr"><strong>#</strong> ' + doc.expr + '</div>'));
		}
		entry.append(result);
		$(".output").append(entry);

		jumpToPageBottom();
	};

	var clearEntries = function() {
		$.when(ddp.call("serverEval/clear")).then(function() {
			$(".result").remove();
		});
	};

	var setState = function(state) {
		if (STATES._current !== state) {
			STATES._current = state;
			newEntry({
				result: state
			}, true);
		}
	};

	var setup = function() {
		setState(STATES.UP);
		//watch ServerEval.results()
		ddp.watch("eval-results", function(doc, msg) {
			if (msg === "added") {
				var _ = doc.expr && newExpression(doc.expr);
				newEntry(doc);
			}
		});
		// poll server and reconnect when server down
		var nIntervId = setInterval(function() {
			ddp.send({
				"ping": "h"
			});
			if (ddp.sock.readyState === 3) {
				clearInterval(nIntervId);
				setState(STATES.DOWN);
				init();
			}
		}, 2000);

		ddp.subscribe("eval-results");
	};

	var init = function() {
		ddp = new MeteorDdp("ws://localhost:3000/websocket");
		ddp.connect().then(function() {
			setup();
		}, function() {
			setTimeout(function() {
				setState(STATES.DOWN);
				init();
			}, 2000);
		});
	};

	init();

	// console handler
	var exprCursorState = "bottom";

	$("#run_eval").bind('keyup', function(evt) {
		if (evt.keyCode == 13) /* enter */ {
			var eval_str = $("#run_eval").val();
			if (eval_str === ".clear") {
				clearEntries();
			} else {
				ddp.call("serverEval/eval", [eval_str]);
			}
			$("#run_eval").val("");
		} else if (evt.keyCode == 38) /*up*/ {
			if (exprCursor > 0) {
				if (exprCursorState === 'up') {
					exprCursor--;
				}
				$("#run_eval").val(expressionHistory[exprCursor]);
				exprCursorState = "up";
			} else if (exprCursor === 0) {
				$("#run_eval").val(expressionHistory[exprCursor]);
			}
		} else if (evt.keyCode == 40) /*down*/ {
			if (exprCursor < expressionHistory.length - 1) {
				if (exprCursorState === 'down') {
					exprCursor++;
				}
				$("#run_eval").val(expressionHistory[exprCursor + 1]);
				exprCursorState = "down";
			} else {
				$("#run_eval").val("");
				exprCursorState = "bottom";
			}
		}
	});
});