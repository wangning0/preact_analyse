import options from './options';
import { defer } from './util';
import { renderComponent } from './vdom/component';

/** Managed queue of dirty components to be re-rendered */
// 一个管理队列， 队列里是需要被重渲染的脏组件
let items = [];

export function enqueueRender(component) {
	//  一次性只能执行一个component
	if (!component._dirty && (component._dirty = true) && items.push(component)==1) {
		// 异步渲染，在下一个loop执行
		(options.debounceRendering || defer)(rerender);
	}
}

export function rerender() {
	let p, list = items;
	items = [];
	while ( (p = list.pop()) ) {
		// 进行渲染
		if (p._dirty) renderComponent(p);
	}
}
