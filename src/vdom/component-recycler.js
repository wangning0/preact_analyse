import { Component } from '../component';

/** Retains a pool of Components for re-use, keyed on component name.
 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
为了组件的再次使用，创建保留组件的公共池，因为那组件的名字不是独一的甚至是可用的，因此他们主要是一种分片的形式
 *	@private
 */
const components = {};


/** Reclaim a component for later re-use by the recycler. */
// 回收组件为以后重复的使用
export function collectComponent(component) {
	let name = component.constructor.name;
	(components[name] || (components[name] = [])).push(component);
}


/** Create a component. Normalizes differences between PFC's and classful Components. */
// 创建组件，归一化pfc和class组件化的区别 pfc指的是pure functional component 函数式无状态的组件
export function createComponent(Ctor, props, context) {
	let list = components[Ctor.name], // 在组件池里面的和component同名的实例
		inst;
	// 先创造一个component的实例
	// 如果在构造函数里有render函数
	if (Ctor.prototype && Ctor.prototype.render) {
		// 先构造一个实例
		inst = new Ctor(props, context);
		// 主要是将component的一些属性和方法附加到组件的实例上
		Component.call(inst, props, context);
	}
	else {
		// 如果在构造函数里没有render函数，preact会分配一个render
		inst = new Component(props, context);
		inst.constructor = Ctor;
		inst.render = doRender;
	}


	if (list) {
		for (let i=list.length; i--; ) {
			// 因为可能存在同名的component 所以需要通过constructor来进行判断
			if (list[i].constructor===Ctor) {
				inst.nextBase = list[i].nextBase;
				// 将缓存中的删除
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}

// PFC组件实例
/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
	return this.constructor(props, context);
}
