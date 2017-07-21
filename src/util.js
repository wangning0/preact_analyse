/** Copy own-properties from `props` onto `obj`.
 *	@returns obj
 *	@private
 */
// 简单的对象的属性的复制
export function extend(obj, props) {
	for (let i in props) obj[i] = props[i];
	return obj;
}

/** Call a function asynchronously, as soon as possible.
 *	@param {Function} callback
 */
export const defer = typeof Promise=='function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;
