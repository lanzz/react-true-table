import _ from 'lodash';
import React, { Component, isValidElement } from 'react';
import PropTypes from 'prop-types';


/**
 * Default custom prop function.
 *
 * Takes no arguments, returns empty custom props.
 */
const emptyProps = () => ({});

/**
 * Default sorting comparator.
 *
 * @param {any} a, b - data rows to compare
 * @param {Column} column - reference to the Column instance
 * @returns {number} - 1 if a > b; -1 if a < b; 0 if a === b
 */
const defaultSort = ({a, b, column}) => {
    const [va, vb] = [column.value(a), column.value(b)];
    return (va > vb) ? 1 : ((va < vb) ? -1 : 0);
};

/**
 * Default sorting renderer.
 *
 * @param {Node} cell - rendered header cell content to wrap
 * @param {boolean} descending - true if sorting in descending order
 */
const defaultRenderSorting = ({cell, descending}) => {
    const arrow = descending ? '∨' : '∧';
    return <React.Fragment>{cell} {arrow}</React.Fragment>;
};


/**
 * Column class.
 *
 * It is used in JSX as a React component, but isn't a true component; it is
 * only a container for a column definition that will be rendered by the parent
 * <Table> component.
 */
export class Column {

    /**
     * Column constructor.
     *
     * @param {object} props - React props
     * @param {Table} table - table instance this column belongs to
     * @param {Group} group - column group instance this column belongs to
     *
     * For top-level columns (not within a column group), group will be
     * undefined.
     */
    constructor(props, table, group) {
        this.props = props;
        this.table = table;
        this.group = group;
    }

    /**
     * Render the header for this column.
     *
     * @param {number} colIndex - index of the parent group within the table
     * @param {string} sort - sort order id
     * @param {boolean} descending - true if sorting in descending order
     * @param {number} groupIndex - index of this column within parent group
     * @param {object} groupProps - extra properties defined for group columns
     * @returns {Element} - <th> element
     *
     * For top-level columns (not within a column group), groupIndex will be
     * undefined and colIndex will be the index of the column itself.
     */
    renderHeader(colIndex, sort, descending, groupIndex, groupProps) {
        if (this.props.hidden) {
            // Do not render hidden columns
            return null;
        }
        var props = this.props.headerProps({
            colIndex, groupIndex, sort: this.isSorted(sort), descending
        });
        if (groupProps) {
            props = {...groupProps, ...props};
        }
        if (groupIndex === undefined) {
            // No parent group, expand to fill both rows of header
            props.rowSpan = 2;
        }
        if (this.props.sortId) {
            // Add click handler to sort by this column
            props.onClick = () => this.table.sortBy(this.props.sortId);
        }
        const key = this.props.key({colIndex, groupIndex});
        const cell = this.table.renderSorting(
            this.props.sortId, this.props.header);
        return <th key={key} {...props}>{cell}</th>;
    }

    /**
     * Render a data cell in this column.
     *
     * @param {object} row - data row
     * @param {number} rowIndex - index of the data row within the dataset
     * @param {number} colIndex - index of the parent group within the table
     * @param {number} groupIndex - index of this column within parent group
     * @param {object} groupProps - extra properties defined for group columns
     * @returns {Element} - <td> element
     */
    renderCell(row, rowIndex, colIndex, groupIndex, groupProps) {
        if (this.props.hidden) {
            return null;
        }
        var props = this.props.tdProps({row, rowIndex, colIndex, groupIndex});
        if (groupProps) {
            props = {...groupProps, ...props};
        }
        const key = this.props.key({row, rowIndex, colIndex, groupIndex});
        const cell = this.props.render({
            row, value: this.value(row), rowIndex, colIndex, groupIndex
        });
        return <td key={key} {...props}>{cell}</td>;
    }

    /**
     * Return a data value from a row for this column.
     *
     * @param {object} row - data row
     * @returns {any} - data value for the column
     */
    value(row) {
        return this.props.value(row);
    }

    /**
     * Register sort order for this column.
     *
     * @param {object} sortMap - sorting registry of the table
     */
    registerSortColumns(sortMap) {
        if (this.props.sortId && this.props.sortMethod) {
            sortMap[this.props.sortId] = this;
        }
    }

    /**
     * Compare two rows for sorting by this column.
     *
     * @param {object} a, b - data rows to compare
     * @param {boolean} descending - true if sorting in descending order
     * @returns {number} - 1 if a > b; -1 if a < b; 0 if a === b
     */
    sort(a, b, descending) {
        const dir = (descending ? -1 : 1);
        return this.props.sortMethod({a, b, descending, column: this}) * dir;
    }

    /**
     * Return true if sorting key matches this column.
     *
     * @param {string} sort - sort order id
     * @returns {boolean} - true if sort order id matches column's sort id
     */
    isSorted(sort) {
        return sort && (sort === this.props.sortId);
    }

}


/**
 * Column group class.
 *
 * As this class extends Column, it also isn't a true React component, but is
 * used in JSX as a container for column group definitions.
 */
export class Group extends Column {

    /**
     * Column group constructor.
     *
     * @param {object} props - React props
     * @param {Table} table - table instance this column group belongs to
     */
    constructor(props, table) {
        super(props);
        this.table = table;
        this.columns = _.map(props.children, (e) => {
            if (!isValidElement(e)) {
                throw new TypeError(
                    `Node of type ${typeof e} not valid in <Group>`
                );
            }
            if (e.type !== Column) {
                // Only columns are allowed inside a group, no nesting
                throw new TypeError(
                    `Element <${e.type.name}> not valid in <Group>`
                );
            }
            return new e.type(e.props, this.table, this);
        });
        if (this.props.sortId && !this.props.sortMethod) {
            // Column groups don't have a defined value, so there is no
            // default way to sort by column groups; a custom sort method
            // is required for column groups that have a sort id
            throw new Error('sortMethod is required for sortable <Group>');
        }
    }

    /**
     * Render the header for this column group.
     *
     * @param {number} colIndex - index of the group within the table
     * @param {string} sort - sort order id
     * @param {boolean} descending - true if sorting in descending order
     * @returns {Array<Element>} - array of <th> elements
     *
     * Return value will contain the <th> for the column group itself, followed
     * by the <th> elements for the child columns.
     */
    renderHeader(colIndex, sort, descending) {
        const props = this.props.headerProps({
            colIndex, sort: this.isSorted(sort), descending
        });
        props.colSpan = this.columns.length;
        if (this.props.sortId) {
            // Add click handler to sort by this column group
            props.onClick = () => this.table.sortBy(this.props.sortId);
        }
        const key = this.props.key({colIndex});
        const cell = this.table.renderSorting(
            this.props.sortId, this.props.header);
        return [
            <th key={key} {...props}>{cell}</th>,
            ..._.map(this.columns, (c, groupIndex) => {
                const groupProps = this.props.subHeaderProps({
                    colIndex, groupIndex, sort: c.isSorted(sort), descending
                });
                return c.renderHeader(
                    colIndex, sort, descending, groupIndex, groupProps
                );
            })
        ];
    }

    /**
     * Render data cells for child columns in this column group.
     *
     * @param {object} row - data row
     * @param {number} rowIndex - index of the data row in the data set
     * @param {number} columnIndex - index of the column group within the table
     * @returns {Array<Element>} - array of <td> elements for each child column
     */
    renderCell(row, rowIndex, columnIndex) {
        return _.map(this.columns, (c, groupIndex) => {
            const groupProps = this.props.tdProps({
                row, rowIndex, columnIndex, groupIndex
            });
            return c.renderCell(
                row, rowIndex, columnIndex, groupIndex, groupProps
            );
        });
    }

    /**
     * Register sort orders for this column group and child columns.
     *
     * @param {object} sortMap - sorting registry of the table
     */
    registerSortColumns(sortMap) {
        if (this.sortId) {
            sortMap[this.sortId] = this;
        }
        _.each(this.columns, (c) => c.registerSortColumns(sortMap));
    }

}


/**
 * Table class.
 *
 * This is a true React component.
 */
export class Table extends Component {

    /**
     * Table constructor.
     *
     * @param {object} props - React props
     */
    constructor(props) {
        super(props);
        this.state = {
            sort: props.sort,
            descending: props.descending,
            columns: this.updateColumns(props.children)
        };
        this.validateProps();
    }

    /**
     * Process prop changes.
     *
     * @param {object} props - React props
     */
    componentWillReceiveProps(props) {
        if (this.props.children !== props.children) {
            // Columns and groups have changed
            this.setState({columns: this.updateColumns(props.children)});
        }
        this.validateProps();
    }

    /**
     * Validate prop sanity and emit warnings.
     */
    validateProps() {
        if (this.state.sort && (!(this.state.sort in this.sortMap))) {
            console.warn(`Invalid sort method: ${this.state.sort}`);
        }
    }

    /**
     * Process columns and column groups.
     *
     * @param {array} children - React child element(s)
     */
    updateColumns(children) {
        this.sortMap = {};
        return React.Children.map(children, (e) => {
            if (!isValidElement(e)) {
                throw new TypeError(
                    `Node of type ${typeof e} not valid in <Table>`
                );
            }
            const instance = new e.type(e.props, this);
            if (!(instance instanceof Column)) {
                throw new TypeError(
                    `Element <${e.type.name}> not valid in <Table>`
                );
            }
            instance.registerSortColumns(this.sortMap);
            return instance;
        });
    }

    /**
     * Render the table.
     *
     * @returns {Element} - <table> element
     */
    render() {
        const props = this.props.tableProps();
        return <table {...props}>
            {this.renderHeader()}
            {this.renderBody()}
        </table>;
    }

    /**
     * Render the table header.
     *
     * @returns {Element} - <thead> element
     */
    renderHeader() {
        const cells = _.map(
            this.state.columns, (c, colIndex) => c.renderHeader(
                colIndex, this.state.sort, this.state.descending
            )
        );
        const theadProps = this.props.theadProps();
        return <thead {...theadProps}>
            {this.renderMainHeader(cells)}
            {this.renderSubHeader(cells)}
        </thead>;
    }

    /**
     * Render the main header row.
     *
     * @param {Array} cells - <th> elements
     * @returns {Element} - <tr> element
     */
    renderMainHeader(cells) {
        const rowCells = _.map(cells, (c) => (c instanceof Array) ? c[0] : c);
        const props = {
            ...this.props.trProps(),
            ...this.props.headerTrProps()
        };
        return <tr {...props}>{rowCells}</tr>;
    }

    /**
     * Render the sub-header row.
     *
     * @param {Array} cells - <th> elements
     * @returns {Element} - <tr> element
     */
    renderSubHeader(cells) {
        const rowCells = _.flatten(
            _.map(cells, (c) => (c instanceof Array) ? c.slice(1) : []));
        if (!rowCells.length) {
            return null;
        }
        const props = {
            ...this.props.trProps(),
            ...this.props.subHeaderTrProps()
        };
        return <tr {...props}>{rowCells}</tr>;
    }

    /**
     * Render the table body.
     *
     * @returns {Element} - <tbody> element
     */
    renderBody() {
        const rows = _.map(
            this.sortedDataIndexes(), (rowIndex) => this.renderRow(rowIndex)
        );
        const props = this.props.tbodyProps();
        return <tbody {...props}>{rows}</tbody>;
    }

    /**
     * Render a data row.
     *
     * @param {any} rowIndex - index of the row in the data set
     * @returns {Element} - <tr> element
     *
     * For array datasets it will be array index, for mapping data sets it will
     * be the mapping key.
     */
    renderRow(rowIndex) {
        const row = this.props.data[rowIndex];
        const props = {
            ...this.props.trProps({row, rowIndex}),
            ...this.props.dataTrProps({row, rowIndex})
        };
        const cells = _.map(
            this.state.columns,
            (c, colIndex) => c.renderCell(row, rowIndex, colIndex)
        );
        return <tr key={rowIndex} {...props}>{cells}</tr>;
    }

    /**
     * Renders sorting indicator on a header cell.
     *
     * @param {string} sortId - sort order id of the column
     * @param {Node} cell - React node content of the header cell
     * @returns {Node} - Header with sorting indicator added if needed
     *
     * Sorting indicator will only be rendered for the sortId matching the
     * current sorting of the table.
     */
    renderSorting(sortId, cell) {
        if (sortId && (sortId === this.state.sort)) {
            cell = this.props.renderSorting({
                cell, descending: this.state.descending
            });
        }
        return cell;
    }

    /**
     * Return array of data set indexes sorted according to the active order.
     *
     * @returns {Array} - sorted indexes
     */
    sortedDataIndexes() {
        const indexes = _.map(this.props.data, (value, index) => index);
        if (!this.sortMap.hasOwnProperty(this.state.sort)) {
            return indexes;
        }
        const column = this.sortMap[this.state.sort];
        indexes.sort((a, b) => {
            return column.sort(
                this.props.data[a], this.props.data[b], this.state.descending
            );
        });
        return indexes;
    }

    /**
     * Change the sorting order of the table.
     *
     * @param {string} sort - sort order id to apply
     * @param {boolean} descending - true if sorting should be descending
     *
     * If descending is undefined and sort matches the current order, the
     * direction will be flipped.
     */
    sortBy(sort, descending) {
        if (descending === undefined) {
            descending =
                (sort === this.state.sort) ? !this.state.descending : false;
        }
        this.setState({sort, descending});
        this.validateProps();
    }

}


Column.propTypes = {
    // Label to render in the header of this column
    header: PropTypes.node,
    // Function that returns the value for this column from a data row
    value: PropTypes.func.isRequired,
    // Function that returns formatted value for display in the table
    render: PropTypes.func.isRequired,
    // Function that returns React key for this column in header and data rows
    key: PropTypes.func.isRequired,
    // Sort order id for this column, if undefined column does not support sort
    sortId: PropTypes.string,
    // Function that compares two rows and returns -1/0/+1 comparison
    sortMethod: PropTypes.func.isRequired,
    // If hidden: true, column will not be rendered
    hidden: PropTypes.bool.isRequired,

    // Function that returns custom props for the header <th> of this column
    headerProps: PropTypes.func.isRequired,
    // Function that returns custom props for the data <td> cells of this column
    tdProps: PropTypes.func.isRequired
};

Column.defaultProps = {
    // Default renderer simply outputs the value for this column
    render: ({value}) => value,
    // Default React key is calculated by column and group indices
    key: ({colIndex, groupIndex}) =>
        (groupIndex === undefined) ? colIndex : `${colIndex}:${groupIndex}`,
    // Default sort method compares the values of the two rows
    sortMethod: defaultSort,
    // Not hidden by default
    hidden: false,

    // No custom props by default
    headerProps: emptyProps,
    tdProps: emptyProps
};

Group.propTypes = {
    // Label to render in the header of this column group
    header: PropTypes.string,
    // Function that returns React key for this column in header and data rows
    key: PropTypes.func.isRequired,
    // Sort order id for this column, if undefined column does not support sort
    sortId: PropTypes.string,
    // Function that compares two rows and returns -1/0/+1 comparison
    // Required for column groups with defined sortId
    sortMethod: PropTypes.func,
    // Column group children are <Column> definitions of the child columns
    children: PropTypes.arrayOf(PropTypes.element),

    // Function that returns custom props for the header <th> of this group
    headerProps: PropTypes.func.isRequired,
    // Function that returns custom props for the header <th> of child columns
    subHeaderProps: PropTypes.func.isRequired,
    // Function that returns custom props for data <td> cells of child columns
    tdProps: PropTypes.func.isRequired
};

Group.defaultProps = {
    // Default React key is the column index of this column group
    key: ({colIndex}) => colIndex,

    // No custom props by default
    headerProps: emptyProps,
    subHeaderProps: emptyProps,
    tdProps: emptyProps
};

Table.propTypes = {
    // Data set to render in the table
    data: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.object
    ]).isRequired,
    // Initial sort order id for the table
    sort: PropTypes.string,
    // Initial sort direction
    descending: PropTypes.bool.isRequired,
    // Function that renders custom sorting indicators
    renderSorting: PropTypes.func.isRequired,
    // Table children are <Column> or <Group> elements
    children: PropTypes.arrayOf(PropTypes.element).isRequired,

    // Function that returns custom props for the <table> element
    tableProps: PropTypes.func.isRequired,
    // Function that returns custom props for the <thead> element
    theadProps: PropTypes.func.isRequired,
    // Function that returns custom props for the main header <tr> element
    headerTrProps: PropTypes.func.isRequired,
    // Function that returns custom props for the sub-header <tr> element
    subHeaderTrProps: PropTypes.func.isRequired,
    // Function that returns custom props for the <tbody> element
    tbodyProps: PropTypes.func.isRequired,
    // Function that returns custom props for data <tr> elements
    dataTrProps: PropTypes.func.isRequired,
    // Function that returns custom props for header and data <tr> elements
    trProps: PropTypes.func.isRequired
};

Table.defaultProps = {
    // Default sorting indicator renderer
    renderSorting: defaultRenderSorting,
    // Ascending sort by default
    descending: false,

    // No custom props by default
    tableProps: emptyProps,
    theadProps: emptyProps,
    headerTrProps: emptyProps,
    subHeaderTrProps: emptyProps,
    tbodyProps: emptyProps,
    dataTrProps: emptyProps,
    trProps: emptyProps
};
