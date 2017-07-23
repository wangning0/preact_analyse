// 该文件的目的主要是将jsx经过babel转义的代码输出成一个vnode，并且指管最上层的组件，即先不管子组件 children component

import { VNode } from './vnode';
import options from './options';

// 将children属性存到栈当中
const stack = [];

const EMPTY_CHILDREN = [];

/** JSX/hyperscript reviver
*	Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *	@see http://jasonformat.com/wtf-is-jsx
 *	@public
 */
// 关于jsx被babel转换后的形式，可以参考babel官网的在线转换工具https://babeljs.io/repl/#?babili=false&evaluate=true&lineWrap=false&presets=es2015%2Creact%2Cstage-2&targets=&browsers=&builtIns=false&debug=false&code_lz=Q
export function h(nodeName, attributes) {
	let children=EMPTY_CHILDREN, lastSimple, child, simple, i;
	// 因为可能存在有很多个子dom节点的情况，就会超过三个参数
	for (i=arguments.length; i-- > 2; ) {
		stack.push(arguments[i]);
	}
	// props里面的childrne和dom节点的children一样的处理，放入一个stack中，然后删除children属性
	if (attributes && attributes.children!=null) {
		if (!stack.length) stack.push(attributes.children);
		delete attributes.children;
	}
	while (stack.length) {
		// 可能child也是一个数组的 pop方法只存在于数组当中
		if ((child = stack.pop()) && child.pop!==undefined) {
			for (i=child.length; i--; ) stack.push(child[i]);
		}
		else {
			if (typeof child==='boolean') child = null;
			// 因为nodename可能也是一个函数，h()这种的函数，即为一个component
			if ((simple = typeof nodeName!=='function')) {
				if (child==null) child = '';
				else if (typeof child==='number') child = String(child);
				// 判断child是不是一个普通的字符串
				else if (typeof child!=='string') simple = false;
			}
			// 如果当前和上一次的child都是string、number、null类型的则可以将他们以字符串的方式进行拼接
			if (simple && lastSimple) {
				children[children.length-1] += child;
			}
			// 将children转化为数组的形式
			else if (children===EMPTY_CHILDREN) {
				children = [child];
			}
			// child push到children
			else {
				children.push(child);
			}

			lastSimple = simple;
		}
	}
	// 构造一个vnode节点
	let p = new VNode();
	p.nodeName = nodeName; 
	p.children = children;
	p.attributes = attributes==null ? undefined : attributes;
	p.key = attributes==null ? undefined : attributes.key;

	// if a "vnode hook" is defined, pass every created VNode to it
	// 钩子函数，当在vnode 虚拟dom节点创造完之后触发该hook函数，对vnode进行处理，
	if (options.vnode!==undefined) options.vnode(p);

	return p;
}

//  一般来说触发了h函数之后，下一步触发的是render函数