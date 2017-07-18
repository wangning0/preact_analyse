import { Component } from '../component';

/** Retains a pool of Components for re-use, keyed on component name.
 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
 *	@private
 */
const components = {};


/** Reclaim a component for later re-use by the recycler. */
export function collectComponent(component) {
	let name = component.constructor.name;
	(components[name] || (components[name] = [])).push(component);
}


/** Create a component. Normalizes differences between PFC's and classful Components. */
export function createComponent(Ctor, props, context) {
	let list = components[Ctor.name],
		inst;
	// 先创造一个component的实例
	// 如果在构造函数里有render函数
	if (Ctor.prototype && Ctor.prototype.render) {
		// 先构造一个实例
		inst = new Ctor(props, context);
		Component.call(inst, props, context);
	}
	else {
		// 如果在构造函数里没有render函数，框架会分配一个render
		inst = new Component(props, context);
		inst.constructor = Ctor;
		inst.render = doRender;
	}


	if (list) {
		for (let i=list.length; i--; ) {
			if (list[i].constructor===Ctor) {
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}


/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
	return this.constructor(props, context);
}
